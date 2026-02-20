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
import { MailService } from '../mail/mail.service.js';
import { RegisterDto } from './dto/register.dto.js';

@Injectable()
export class AuthService {
  // Injection de dépendance : NestJS fournit automatiquement PrismaService et JwtService
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
    private mailService: MailService,
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

    // 4. Envoyer l'email de vérification
    const verificationToken = await this.createVerificationToken(user.id);
    await this.mailService.sendVerificationEmail(user.email, user.name, verificationToken);

    // 5. Retourner l'utilisateur SANS le mot de passe
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

    if (!user.isEmailChecked) {
      throw new UnauthorizedException('Veuillez vérifier votre adresse email avant de vous connecter');
    }

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

  // Génère un token de vérification d'email, stocke le hash en base
  private async createVerificationToken(userId: number): Promise<string> {
    // Supprimer les anciens tokens de cet utilisateur
    await this.prisma.emailVerification.deleteMany({ where: { userId } });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');

    await this.prisma.emailVerification.create({
      data: {
        token: hash,
        userId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
      },
    });

    return rawToken;
  }

  // Vérifie le token reçu par email et marque l'email comme vérifié
  async verifyEmail(token: string) {
    const hash = crypto.createHash('sha256').update(token).digest('hex');

    const verification = await this.prisma.emailVerification.findFirst({
      where: {
        token: hash,
        expiresAt: { gt: new Date() },
      },
    });

    if (!verification) {
      throw new UnauthorizedException('Token de vérification invalide ou expiré');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: verification.userId },
        data: { isEmailChecked: true },
      }),
      this.prisma.emailVerification.delete({
        where: { id: verification.id },
      }),
    ]);

    return { message: 'Email vérifié avec succès' };
  }

  // Demande de réinitialisation de mot de passe
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Réponse générique : ne jamais révéler si l'email existe
    if (!user) {
      return { message: 'Si un compte existe avec cet email, un lien de réinitialisation a été envoyé' };
    }

    // Supprimer les anciens tokens de reset de cet utilisateur
    await this.prisma.passwordReset.deleteMany({ where: { userId: user.id } });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');

    await this.prisma.passwordReset.create({
      data: {
        token: hash,
        userId: user.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1h
      },
    });

    await this.mailService.sendPasswordResetEmail(user.email, user.name, rawToken);

    return { message: 'Si un compte existe avec cet email, un lien de réinitialisation a été envoyé' };
  }

  // Réinitialisation du mot de passe avec le token reçu par email
  async resetPassword(token: string, newPassword: string) {
    const hash = crypto.createHash('sha256').update(token).digest('hex');

    const resetRecord = await this.prisma.passwordReset.findFirst({
      where: {
        token: hash,
        expiresAt: { gt: new Date() },
      },
    });

    if (!resetRecord) {
      throw new UnauthorizedException('Token de réinitialisation invalide ou expiré');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetRecord.userId },
        data: { password: hashedPassword },
      }),
      this.prisma.passwordReset.delete({ where: { id: resetRecord.id } }),
      this.prisma.refreshToken.deleteMany({ where: { userId: resetRecord.userId } }),
    ]);

    return { message: 'Mot de passe réinitialisé avec succès. Veuillez vous reconnecter.' };
  }

  // Renvoie un email de vérification (réponse générique pour ne pas révéler l'existence du compte)
  async resendVerificationEmail(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || user.isEmailChecked) {
      return { message: 'Si un compte non vérifié existe avec cet email, un nouveau lien a été envoyé' };
    }

    const verificationToken = await this.createVerificationToken(user.id);
    await this.mailService.sendVerificationEmail(user.email, user.name, verificationToken);

    return { message: 'Si un compte non vérifié existe avec cet email, un nouveau lien a été envoyé' };
  }
}
