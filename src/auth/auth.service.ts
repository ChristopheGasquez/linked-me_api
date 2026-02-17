import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegisterDto } from './dto/register.dto.js';

@Injectable()
export class AuthService {
  // Injection de dépendance : NestJS fournit automatiquement PrismaService et JwtService
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  // Inscription d'un nouvel utilisateur
  async register(dto: RegisterDto) {
    // 1. Vérifier si l'email existe déjà
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      // 409 Conflict — l'email est déjà pris
      throw new ConflictException('Cet email est déjà utilisé');
    }

    // 2. Hasher le mot de passe (JAMAIS stocker en clair !)
    // Le "10" est le nombre de "rounds" de salage — plus c'est élevé, plus c'est lent mais sécurisé
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // 3. Créer l'utilisateur en base avec le rôle USER par défaut
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
        // Assigner automatiquement le rôle USER à l'inscription
        roles: {
          create: {
            role: { connect: { name: 'USER' } },
          },
        },
      },
    });

    // 4. Retourner l'utilisateur SANS le mot de passe
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  // Vérification des identifiants (utilisé par le login)
  async validateUser(email: string, password: string) {
    // 1. Chercher l'utilisateur par email
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Identifiants incorrects');
    }

    // 2. Comparer le mot de passe envoyé avec le hash en base
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      // Même message que "user not found" pour ne pas révéler si l'email existe
      throw new UnauthorizedException('Identifiants incorrects');
    }

    // 3. Retourner l'utilisateur SANS le mot de passe
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  // Connexion : vérifie les identifiants puis génère les tokens
  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);
    const tokens = await this.generateTokens(user.id, user.email);
    return { ...tokens, user };
  }

  // Génère access_token + refresh_token, stocke le refresh hashé en base
  private async generateTokens(userId: number, email: string) {
    const payload = { sub: userId, email };

    const access_token = await this.jwtService.signAsync(payload);

    const refresh_token = await this.jwtService.signAsync(payload, {
      secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get('JWT_REFRESH_EXPIRY', '7d'),
    });

    // Stocker le hash du refresh token en base
    const hash = crypto.createHash('sha256').update(refresh_token).digest('hex');
    const decoded = this.jwtService.decode(refresh_token) as { exp: number };

    await this.prisma.refreshToken.create({
      data: {
        token: hash,
        userId,
        expiresAt: new Date(decoded.exp * 1000),
      },
    });

    return { access_token, refresh_token };
  }

  // Rafraîchir les tokens (rotation : ancien invalidé, nouveau généré)
  async refresh(refreshToken: string) {
    let payload: { sub: number; email: string };
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token invalide ou expiré');
    }

    const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const stored = await this.prisma.refreshToken.findFirst({
      where: { token: hash, userId: payload.sub },
    });

    if (!stored) {
      throw new UnauthorizedException('Refresh token révoqué');
    }

    // Supprimer l'ancien (rotation)
    await this.prisma.refreshToken.delete({ where: { id: stored.id } });

    // Générer une nouvelle paire
    return this.generateTokens(payload.sub, payload.email);
  }

  // Révoquer un refresh token (logout)
  async logout(refreshToken: string) {
    const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await this.prisma.refreshToken.deleteMany({ where: { token: hash } });
    return { message: 'Déconnexion réussie' };
  }

  // Révoquer tous les refresh tokens d'un utilisateur (logout-all)
  async logoutAll(userId: number) {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
    return { message: 'Toutes les sessions ont été révoquées' };
  }
}
