import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { isUUID } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CachedUser, UserCacheService } from '../cache/user-cache.service.js';
import { authCookieNames, isCookieSecure } from '../auth-cookies.js';
import { getJwtSecret, JWT_ALGORITHM } from '../jwt-secret.js';

interface JwtPayload {
  sub: string; // JWT standard claim: user id
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private userCache: UserCacheService,
  ) {
    const accessCookie = authCookieNames(isCookieSecure(config)).access;
    super({
      jwtFromRequest: (req: Request) =>
        (req.cookies?.[accessCookie] as string | undefined) ?? null,
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(config),
      algorithms: [JWT_ALGORITHM],
    });
  }

  async validate(payload: JwtPayload): Promise<CachedUser> {
    if (!isUUID(payload.sub, '7')) throw new UnauthorizedException();

    const cached = this.userCache.get(payload.sub);
    if (cached) return cached;

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
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

    const permissions = user.roles.flatMap((ur) =>
      ur.role.permissions.map((rp) => rp.permission.name),
    );

    const roles = user.roles.map((ur) => ur.role.name);

    const { password: _password, roles: _, ...userWithoutPassword } = user;
    const result = { ...userWithoutPassword, roles, permissions };
    this.userCache.set(payload.sub, result);
    return result;
  }
}
