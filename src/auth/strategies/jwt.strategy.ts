import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service.js';

// Le "payload" contenu dans le token JWT
interface JwtPayload {
  sub: number; // sub = "subject" = l'ID de l'utilisateur (convention JWT)
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      // Où trouver le token ? Dans le header "Authorization: Bearer <token>"
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // Refuser les tokens expirés
      ignoreExpiration: false,
      // Clé secrète pour vérifier la signature
      secretOrKey: process.env.JWT_SECRET as string,
    });
  }

  // Appelé automatiquement par Passport après vérification du token
  // Le "payload" est le contenu décodé du token
  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      // Charger les rôles et leurs permissions en une seule requête
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    // Extraire les noms de permissions en une liste plate : ['READ_USER', 'EDIT_OWN_PROFILE', ...]
    const permissions = user.roles.flatMap((ur) =>
      ur.role.permissions.map((rp) => rp.permission.name),
    );

    // Extraire les noms de rôles : ['USER', 'ADMIN', ...]
    const roles = user.roles.map((ur) => ur.role.name);

    // Retourner l'utilisateur avec ses rôles et permissions (sans le mot de passe ni les relations brutes)
    const { password, roles: _, ...userWithoutPassword } = user;
    return { ...userWithoutPassword, roles, permissions };
  }
}
