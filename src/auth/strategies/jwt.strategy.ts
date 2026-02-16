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
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    // Ce qui est retourné ici sera disponible dans request.user
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}
