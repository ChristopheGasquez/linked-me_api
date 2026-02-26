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

    const tokens = await this.generateTokens(user.id, user.email);
    return { ...tokens, user };
  }

  private async generateTokens(userId: number, email: string) {
    const payload = { sub: userId, email };

    const access_token = await this.jwtService.signAsync(payload);

    const refresh_token = await this.jwtService.signAsync(payload, {
      secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get('JWT_REFRESH_EXPIRY', '7d'),
    });

    const hash = crypto
      .createHash('sha256')
      .update(refresh_token)
      .digest('hex');
    const decoded = this.jwtService.decode(refresh_token);

    await this.prisma.refreshToken.create({
      data: {
        token: hash,
        userId,
        expiresAt: new Date(decoded.exp * 1000),
      },
    });

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

    return { access_token, refresh_token };
  }

  async refresh(refreshToken: string) {
    let payload: { sub: number; email: string };
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException({
        message: 'Invalid or expired refresh token',
        code: ResponseCodes.AUTH_REFRESH_INVALID_TOKEN,
      });
    }

    const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const stored = await this.prisma.refreshToken.findFirst({
      where: { token: hash, userId: payload.sub },
    });

    if (!stored) {
      throw new UnauthorizedException({
        message: 'Refresh token revoked',
        code: ResponseCodes.AUTH_REFRESH_TOKEN_REVOKED,
      });
    }

    await this.prisma.refreshToken.delete({ where: { id: stored.id } });

    return this.generateTokens(payload.sub, payload.email);
  }

  async logout(refreshToken: string) {
    const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await this.prisma.refreshToken.deleteMany({ where: { token: hash } });
    return { message: 'Logged out successfully', code: ResponseCodes.AUTH_LOGOUT_SUCCESS };
  }

  async getSessions(userId: number, query: FindSessionsQueryDto) {
    return paginate(this.prisma.refreshToken, query, {
      where: { userId, expiresAt: { gt: new Date() } },
    });
  }

  async revokeSession(userId: number, sessionId: number) {
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
    return { message: 'Session revoked', code: ResponseCodes.AUTH_SESSION_REVOKED };
  }

  async logoutAll(userId: number) {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
    return { message: 'All sessions revoked', code: ResponseCodes.AUTH_LOGOUT_ALL_SUCCESS };
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

  private async createVerificationToken(userId: number): Promise<string> {
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

    return { message: 'Email verified successfully', code: ResponseCodes.AUTH_EMAIL_VERIFIED };
  }

  async forgotPassword(email: string, callbackUrl?: string) {
    this.validateCallbackUrl(callbackUrl);

    const user = await this.prisma.user.findUnique({ where: { email } });

    // Generic response: never reveal whether email exists
    if (!user) {
      return {
        message: 'If an account with this email exists, a reset link has been sent',
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
      message: 'If an account with this email exists, a reset link has been sent',
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
        message: 'If an unverified account with this email exists, a new link has been sent',
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
      message: 'If an unverified account with this email exists, a new link has been sent',
      code: ResponseCodes.AUTH_EMAIL_RESEND_SENT,
    };
  }
}
