import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { UserCacheService } from './cache/user-cache.service.js';
import { AuthCookies, accessTokenTtlSeconds } from './auth-cookies.js';
import { getJwtSecret, JWT_ALGORITHM } from './jwt-secret.js';

@Module({
  imports: [
    // registerAsync attend que ConfigModule soit chargé avant de lire les variables
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: getJwtSecret(config),
        signOptions: {
          algorithm: JWT_ALGORITHM,
          expiresIn: accessTokenTtlSeconds(config),
        },
        verifyOptions: { algorithms: [JWT_ALGORITHM] },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, UserCacheService, AuthCookies],
  exports: [AuthService, UserCacheService, AuthCookies],
})
export class AuthModule {}
