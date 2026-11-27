import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { isUUID } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { AuditService } from '../audit/audit.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { FindSessionsQueryDto } from './dto/find-sessions-query.dto.js';
import { paginate } from '../../common/pagination/index.js';
import {
  BCRYPT_ROUNDS,
  MS_PER_DAY,
  MS_PER_HOUR,
} from '../../common/constants.js';
import { ResponseCodes } from '../../common/constants/response-codes.js';

@Injectable()
export class AuthService {
  private readonly MAX_FAILED_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION_MS = 15 * 60 * 1000;
  private readonly MAX_SESSIONS_PER_USER = 10;
  private readonly REFRESH_GRACE_MS = 30 * 1000;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
    private mailService: MailService,
    private auditService: AuditService,
  ) {}

  async register(dto: RegisterDto) {
    this.validateCallbackUrl(dto.callbackUrl);

    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException({
        message: 'Email already in use',
        code: ResponseCodes.AUTH_REGISTER_CONFLICT,
      });
    }

    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
        roles: {
          create: {
            role: { connect: { name: 'USER' } },
          },
        },
      },
    });

    const verificationToken = await this.createVerificationToken(user.id);
    await this.mailService.sendVerificationEmail(
      user.email,
      user.name,
      verificationToken,
      dto.callbackUrl,
    );

    await this.auditService.log('user.create', user.id, user.id, 'user', {
      email: user.email,
      name: user.name,
    });

    const { password: _password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new UnauthorizedException({
        message: 'Invalid credentials',
        code: ResponseCodes.AUTH_LOGIN_INVALID_CREDENTIALS,
      });
    }

    const now = new Date();

    if (user.lockedUntil && user.lockedUntil > now) {
      const remaining = Math.ceil(
        (user.lockedUntil.getTime() - now.getTime()) / 60000,
      );
      throw new ForbiddenException({
        message: `Account temporarily locked. Try again in ${remaining} minute(s).`,
        code: ResponseCodes.AUTH_LOGIN_ACCOUNT_LOCKED,
      });
    }

    const baseAttempts =
      user.lockedUntil && user.lockedUntil <= now
        ? 0
        : user.failedLoginAttempts;

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      const newAttempts = baseAttempts + 1;
      const isNowLocked = newAttempts >= this.MAX_FAILED_ATTEMPTS;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: newAttempts,
          lockedUntil: isNowLocked
            ? new Date(now.getTime() + this.LOCKOUT_DURATION_MS)
            : null,
        },
      });
      if (isNowLocked) {
        await this.mailService.sendAccountLockedEmail(user.email, user.name);
        await this.auditService.log('login.locked', null, user.id, 'user', {
          email: user.email,
        });
      } else {
        await this.auditService.log('login.failed', null, user.id, 'user', {
          email: user.email,
        });
      }
      throw new UnauthorizedException({
        message: 'Invalid credentials',
        code: ResponseCodes.AUTH_LOGIN_INVALID_CREDENTIALS,
      });
    }

    // Success: reset failure counter
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });

    const {
      password: _,
      failedLoginAttempts: __,
      lockedUntil: ___,
      ...userWithoutSensitive
    } = user;
    return userWithoutSensitive;
  }

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);

    if (!user.isEmailChecked) {
      throw new UnauthorizedException({
        message: 'Please verify your email before logging in',
        code: ResponseCodes.AUTH_LOGIN_EMAIL_NOT_VERIFIED,
      });
    }

    const tokens = await this.createSession(user.id, user.email);
    return { ...tokens, user };
  }

  private async createSession(userId: string, email: string) {
    const secret = this.newRefreshSecret();
    const session = await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.hashToken(secret),
        userId,
        expiresAt: this.refreshExpiry(new Date()),
      },
      select: { id: true },
    });
    await this.evictOldestSessions(userId);
    return {
      access_token: await this.signAccessToken(userId, email),
      refresh_token: `${session.id}.${secret}`,
    };
  }

  private async evictOldestSessions(userId: string) {
    const userTokens = await this.prisma.refreshToken.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (userTokens.length > this.MAX_SESSIONS_PER_USER) {
      const toDelete = userTokens.slice(
        0,
        userTokens.length - this.MAX_SESSIONS_PER_USER,
      );
      await this.prisma.refreshToken.deleteMany({
        where: { id: { in: toDelete.map((t) => t.id) } },
      });
    }
  }

  async refresh(
    refreshToken: string | undefined,
  ): Promise<{ access_token: string; refresh_token?: string }> {
    const parsed = this.parseRefreshToken(refreshToken);
    if (!parsed) throw this.invalidRefreshToken();

    const session = await this.prisma.refreshToken.findUnique({
      where: { id: parsed.sessionId },
      include: { user: { select: { email: true } } },
    });
    if (!session) {
      throw new UnauthorizedException({
        message: 'Refresh token revoked',
        code: ResponseCodes.AUTH_REFRESH_TOKEN_REVOKED,
      });
    }

    const now = new Date();
    if (session.expiresAt <= now) throw this.invalidRefreshToken();

    if (this.hashesEqual(parsed.secretHash, session.tokenHash)) {
      const secret = this.newRefreshSecret();
      const { count } = await this.prisma.refreshToken.updateMany({
        where: { id: session.id, tokenHash: session.tokenHash },
        data: {
          tokenHash: this.hashToken(secret),
          previousTokenHash: session.tokenHash,
          rotatedAt: now,
          expiresAt: this.refreshExpiry(now),
        },
      });
      // Lost a concurrent rotation (or logout): re-evaluate against the new state
      if (count === 0) return this.refresh(refreshToken);
      return {
        access_token: await this.signAccessToken(
          session.userId,
          session.user.email,
        ),
        refresh_token: `${session.id}.${secret}`,
      };
    }

    const withinGrace =
      this.hashesEqual(parsed.secretHash, session.previousTokenHash) &&
      session.rotatedAt !== null &&
      now.getTime() - session.rotatedAt.getTime() < this.REFRESH_GRACE_MS;
    if (withinGrace) {
      // Concurrent refresh: the other request already got the new refresh token
      return {
        access_token: await this.signAccessToken(
          session.userId,
          session.user.email,
        ),
      };
    }

    await this.prisma.refreshToken.deleteMany({ where: { id: session.id } });
    await this.auditService.log(
      'session.reuse_detected',
      null,
      session.userId,
      'user',
      { sessionId: session.id },
    );
    throw new UnauthorizedException({
      message: 'Refresh token reuse detected, session revoked',
      code: ResponseCodes.AUTH_REFRESH_TOKEN_REUSED,
    });
  }

  async logout(refreshToken: string | undefined) {
    const parsed = this.parseRefreshToken(refreshToken);
    if (parsed) {
      await this.prisma.refreshToken.deleteMany({
        where: {
          id: parsed.sessionId,
          OR: [
            { tokenHash: parsed.secretHash },
            { previousTokenHash: parsed.secretHash },
          ],
        },
      });
    }
    return {
      message: 'Logged out successfully',
      code: ResponseCodes.AUTH_LOGOUT_SUCCESS,
    };
  }

  async getSessions(
    userId: string,
    query: FindSessionsQueryDto,
    refreshToken?: string,
  ) {
    const currentId = this.sessionIdOf(refreshToken);
    const result = await paginate(this.prisma.refreshToken, query, {
      where: { userId, expiresAt: { gt: new Date() } },
    });
    return {
      ...result,
      data: result.data.map(
        ({ tokenHash: _t, previousTokenHash: _p, ...session }) => ({
          ...session,
          current: session.id === currentId,
        }),
      ),
    };
  }

  sessionIdOf(refreshToken: string | undefined) {
    return this.splitRefreshToken(refreshToken)?.sessionId;
  }

  async revokeSession(userId: string, sessionId: string) {
    const session = await this.prisma.refreshToken.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) {
      throw new NotFoundException({
        message: 'Session not found',
        code: ResponseCodes.AUTH_SESSION_NOT_FOUND,
      });
    }
    await this.prisma.refreshToken.delete({ where: { id: sessionId } });
    return {
      message: 'Session revoked',
      code: ResponseCodes.AUTH_SESSION_REVOKED,
    };
  }

  async logoutAll(userId: string) {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
    return {
      message: 'All sessions revoked',
      code: ResponseCodes.AUTH_LOGOUT_ALL_SUCCESS,
    };
  }

  private splitRefreshToken(token: string | undefined) {
    if (!token) return null;
    const [sessionId, secret, ...rest] = token.split('.');
    if (rest.length > 0 || !secret || !isUUID(sessionId, '7')) return null;
    return { sessionId, secret };
  }

  private parseRefreshToken(token: string | undefined) {
    const parts = this.splitRefreshToken(token);
    if (!parts) return null;
    return {
      sessionId: parts.sessionId,
      secretHash: this.hashToken(parts.secret),
    };
  }

  private hashesEqual(hash: string, stored: string | null) {
    return (
      stored !== null &&
      crypto.timingSafeEqual(
        Buffer.from(hash, 'hex'),
        Buffer.from(stored, 'hex'),
      )
    );
  }

  private hashToken(value: string) {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  private newRefreshSecret() {
    return crypto.randomBytes(32).toString('base64url');
  }

  private refreshExpiry(from: Date) {
    const days = Number(this.config.get('REFRESH_TOKEN_TTL_DAYS', 7));
    return new Date(from.getTime() + days * MS_PER_DAY);
  }

  private signAccessToken(userId: string, email: string) {
    return this.jwtService.signAsync({ sub: userId, email });
  }

  private invalidRefreshToken() {
    return new UnauthorizedException({
      message: 'Invalid or expired refresh token',
      code: ResponseCodes.AUTH_REFRESH_INVALID_TOKEN,
    });
  }

  private validateCallbackUrl(callbackUrl: string | undefined): void {
    if (!callbackUrl) return;
    const raw = this.config.get<string>('ALLOWED_REDIRECT_ORIGINS', '');
    const allowedOrigins = raw ? raw.split(',').map((o) => o.trim()) : [];
    let origin: string;
    try {
      origin = new URL(callbackUrl).origin;
    } catch {
      throw new BadRequestException({
        message: 'Callback URL not allowed',
        code: ResponseCodes.AUTH_CALLBACK_URL_NOT_ALLOWED,
      });
    }
    if (!allowedOrigins.includes(origin)) {
      throw new BadRequestException({
        message: 'Callback URL not allowed',
        code: ResponseCodes.AUTH_CALLBACK_URL_NOT_ALLOWED,
      });
    }
  }

  private async createVerificationToken(userId: string): Promise<string> {
    await this.prisma.emailVerification.deleteMany({ where: { userId } });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');

    await this.prisma.emailVerification.create({
      data: {
        token: hash,
        userId,
        expiresAt: new Date(Date.now() + MS_PER_DAY),
      },
    });

    return rawToken;
  }

  async verifyEmail(token: string) {
    const hash = crypto.createHash('sha256').update(token).digest('hex');

    const verification = await this.prisma.emailVerification.findFirst({
      where: {
        token: hash,
        expiresAt: { gt: new Date() },
      },
    });

    if (!verification) {
      throw new UnauthorizedException({
        message: 'Invalid or expired verification token',
        code: ResponseCodes.AUTH_EMAIL_INVALID_TOKEN,
      });
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

    await this.auditService.log(
      'email.verified',
      verification.userId,
      verification.userId,
      'user',
    );

    return {
      message: 'Email verified successfully',
      code: ResponseCodes.AUTH_EMAIL_VERIFIED,
    };
  }

  async forgotPassword(email: string, callbackUrl?: string) {
    this.validateCallbackUrl(callbackUrl);

    const user = await this.prisma.user.findUnique({ where: { email } });

    // Generic response: never reveal whether email exists
    if (!user) {
      return {
        message:
          'If an account with this email exists, a reset link has been sent',
        code: ResponseCodes.AUTH_FORGOT_PASSWORD_SENT,
      };
    }

    await this.prisma.passwordReset.deleteMany({ where: { userId: user.id } });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');

    await this.prisma.passwordReset.create({
      data: {
        token: hash,
        userId: user.id,
        expiresAt: new Date(Date.now() + MS_PER_HOUR),
      },
    });

    await this.mailService.sendPasswordResetEmail(
      user.email,
      user.name,
      rawToken,
      callbackUrl,
    );

    return {
      message:
        'If an account with this email exists, a reset link has been sent',
      code: ResponseCodes.AUTH_FORGOT_PASSWORD_SENT,
    };
  }

  async resetPassword(token: string, newPassword: string) {
    const hash = crypto.createHash('sha256').update(token).digest('hex');

    const resetRecord = await this.prisma.passwordReset.findFirst({
      where: {
        token: hash,
        expiresAt: { gt: new Date() },
      },
    });

    if (!resetRecord) {
      throw new UnauthorizedException({
        message: 'Invalid or expired reset token',
        code: ResponseCodes.AUTH_PASSWORD_RESET_INVALID,
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetRecord.userId },
        data: { password: hashedPassword },
      }),
      this.prisma.passwordReset.delete({ where: { id: resetRecord.id } }),
      this.prisma.refreshToken.deleteMany({
        where: { userId: resetRecord.userId },
      }),
    ]);

    await this.auditService.log(
      'password.reset',
      resetRecord.userId,
      resetRecord.userId,
      'user',
    );

    return {
      message: 'Password reset successfully. Please log in again.',
      code: ResponseCodes.AUTH_PASSWORD_RESET_SUCCESS,
    };
  }

  async resendVerificationEmail(email: string, callbackUrl?: string) {
    this.validateCallbackUrl(callbackUrl);

    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || user.isEmailChecked) {
      return {
        message:
          'If an unverified account with this email exists, a new link has been sent',
        code: ResponseCodes.AUTH_EMAIL_RESEND_SENT,
      };
    }

    const verificationToken = await this.createVerificationToken(user.id);
    await this.mailService.sendVerificationEmail(
      user.email,
      user.name,
      verificationToken,
      callbackUrl,
    );

    return {
      message:
        'If an unverified account with this email exists, a new link has been sent',
      code: ResponseCodes.AUTH_EMAIL_RESEND_SENT,
    };
  }
}
