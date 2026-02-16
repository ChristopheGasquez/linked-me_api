import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegisterDto } from './dto/register.dto.js';

@Injectable()
export class AuthService {
  // Injection de dépendance : NestJS fournit automatiquement PrismaService et JwtService
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
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

    // 3. Créer l'utilisateur en base
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
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

  // Connexion : vérifie les identifiants puis génère un token JWT
  async login(email: string, password: string) {
    // 1. Valider les identifiants (réutilise validateUser)
    const user = await this.validateUser(email, password);

    // 2. Créer le "payload" du token — les données encodées dans le JWT
    // "sub" (subject) = convention JWT pour l'identifiant principal
    const payload = { sub: user.id, email: user.email };

    // 3. Générer le token signé et le retourner avec les infos user
    return {
      access_token: await this.jwtService.signAsync(payload),
      user,
    };
  }
}
