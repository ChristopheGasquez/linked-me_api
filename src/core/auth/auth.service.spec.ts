jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { AuditService } from '../audit/audit.service.js';
import {
  createPrismaServiceMock,
  PrismaServiceMock,
} from '../prisma/prisma.service.mock.js';

const mockUser = {
  id: 1,
  email: 'test@example.com',
  password: 'hashed_password',
  name: 'Test User',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  isEmailChecked: true,
  failedLoginAttempts: 0,
  lockedUntil: null as Date | null,
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaServiceMock;
  let jwtService: jest.Mocked<JwtService>;
  let mailService: jest.Mocked<
    Pick<
      MailService,
      | 'sendVerificationEmail'
      | 'sendPasswordResetEmail'
      | 'sendAccountLockedEmail'
    >
  >;
  let auditService: jest.Mocked<Pick<AuditService, 'log'>>;

  beforeEach(async () => {
    prisma = createPrismaServiceMock();

    jwtService = {
      signAsync: jest.fn().mockResolvedValue('mock_token'),
      decode: jest
        .fn()
        .mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 }),
      verifyAsync: jest
        .fn()
        .mockResolvedValue({ sub: 1, email: 'test@example.com' }),
    } as any;

    const configService = {
      getOrThrow: jest.fn().mockReturnValue('mock_secret'),
      get: jest.fn().mockReturnValue('7d'),
    };

    mailService = {
      sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
      sendAccountLockedEmail: jest.fn().mockResolvedValue(undefined),
    };

    auditService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        { provide: MailService, useValue: mailService },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // register()
  // ─────────────────────────────────────────────────────────────
  describe('register()', () => {
    it('should throw ConflictException if email already in use', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);

      await expect(
        service.register({
          email: 'test@example.com',
          password: 'password',
          name: 'Test',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create user, send verification email and return user without password', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser as any);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');

      prisma.emailVerification.deleteMany.mockResolvedValue({ count: 0 });
      prisma.emailVerification.create.mockResolvedValue({} as any);

      const result = await service.register({
        email: 'test@example.com',
        password: 'password',
        name: 'Test User',
      });

      expect(prisma.user.create).toHaveBeenCalledTimes(1);
      expect(mailService.sendVerificationEmail).toHaveBeenCalledTimes(1);
      expect(auditService.log).toHaveBeenCalledWith(
        'user.create',
        1,
        1,
        'user',
        expect.any(Object),
      );
      expect(result).not.toHaveProperty('password');
      expect(result).toMatchObject({ id: 1, email: 'test@example.com' });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // validateUser()
  // ─────────────────────────────────────────────────────────────
  describe('validateUser()', () => {
    it('should throw UnauthorizedException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.validateUser('unknown@example.com', 'password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ForbiddenException if account is locked', async () => {
      const lockedUser = {
        ...mockUser,
        lockedUntil: new Date(Date.now() + 5 * 60 * 1000),
      };
      prisma.user.findUnique.mockResolvedValue(lockedUser as any);

      await expect(
        service.validateUser('test@example.com', 'password'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw UnauthorizedException and increment failedLoginAttempts on wrong password', async () => {
      const user = { ...mockUser, failedLoginAttempts: 2 };
      prisma.user.findUnique.mockResolvedValue(user as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      prisma.user.update.mockResolvedValue(user as any);

      await expect(
        service.validateUser('test@example.com', 'wrong'),
      ).rejects.toThrow(UnauthorizedException);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ failedLoginAttempts: 3 }),
        }),
      );
      expect(mailService.sendAccountLockedEmail).not.toHaveBeenCalled();
    });

    it('should lock account and send email on 5th failed attempt', async () => {
      const user = { ...mockUser, failedLoginAttempts: 4 };
      prisma.user.findUnique.mockResolvedValue(user as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      prisma.user.update.mockResolvedValue(user as any);

      await expect(
        service.validateUser('test@example.com', 'wrong'),
      ).rejects.toThrow(UnauthorizedException);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            failedLoginAttempts: 5,
            lockedUntil: expect.any(Date),
          }),
        }),
      );
      expect(mailService.sendAccountLockedEmail).toHaveBeenCalledWith(
        mockUser.email,
        mockUser.name,
      );
      expect(auditService.log).toHaveBeenCalledWith(
        'login.locked',
        null,
        1,
        'user',
        expect.any(Object),
      );
    });

    it('should reset baseAttempts to 0 when lock has expired', async () => {
      const user = {
        ...mockUser,
        failedLoginAttempts: 5,
        lockedUntil: new Date(Date.now() - 1000),
      };
      prisma.user.findUnique.mockResolvedValue(user as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      prisma.user.update.mockResolvedValue(user as any);

      await expect(
        service.validateUser('test@example.com', 'wrong'),
      ).rejects.toThrow(UnauthorizedException);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ failedLoginAttempts: 1 }),
        }),
      );
    });

    it('should reset failedLoginAttempts to 0 on successful login', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.user.update.mockResolvedValue(mockUser as any);

      const result = await service.validateUser('test@example.com', 'password');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { failedLoginAttempts: 0, lockedUntil: null },
        }),
      );
      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('failedLoginAttempts');
      expect(result).not.toHaveProperty('lockedUntil');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // login()
  // ─────────────────────────────────────────────────────────────
  describe('login()', () => {
    it('should throw UnauthorizedException if email not verified', async () => {
      const unverifiedUser = { ...mockUser, isEmailChecked: false };
      prisma.user.findUnique.mockResolvedValue(unverifiedUser as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.user.update.mockResolvedValue(unverifiedUser as any);

      await expect(
        service.login('test@example.com', 'password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return tokens and user on success', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.user.update.mockResolvedValue(mockUser as any);
      prisma.refreshToken.create.mockResolvedValue({} as any);
      prisma.refreshToken.findMany.mockResolvedValue([]);

      const result = await service.login('test@example.com', 'password');

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
      expect(result).toHaveProperty('user');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // refresh()
  // ─────────────────────────────────────────────────────────────
  describe('refresh()', () => {
    it('should throw UnauthorizedException if token is invalid', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('invalid token'));

      await expect(service.refresh('bad_token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if token not found in DB (revoked)', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 1,
        email: 'test@example.com',
      } as any);
      prisma.refreshToken.findFirst.mockResolvedValue(null);

      await expect(service.refresh('valid_but_revoked_token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should rotate token and return new tokens on success', async () => {
      const storedToken = {
        id: 10,
        token: 'hash',
        userId: 1,
        expiresAt: new Date(),
        createdAt: new Date(),
      };
      jwtService.verifyAsync.mockResolvedValue({
        sub: 1,
        email: 'test@example.com',
      } as any);
      prisma.refreshToken.findFirst.mockResolvedValue(storedToken as any);
      prisma.refreshToken.delete.mockResolvedValue(storedToken as any);
      prisma.refreshToken.create.mockResolvedValue({} as any);
      prisma.refreshToken.findMany.mockResolvedValue([]);

      const result = await service.refresh('valid_token');

      expect(prisma.refreshToken.delete).toHaveBeenCalledWith({
        where: { id: 10 },
      });
      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // logout()
  // ─────────────────────────────────────────────────────────────
  describe('logout()', () => {
    it('should delete refresh token and return success message', async () => {
      prisma.refreshToken.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.logout('some_refresh_token');

      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ message: 'Logged out successfully' });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // logoutAll()
  // ─────────────────────────────────────────────────────────────
  describe('logoutAll()', () => {
    it('should revoke all sessions for the user', async () => {
      prisma.refreshToken.deleteMany.mockResolvedValue({ count: 3 });

      const result = await service.logoutAll(1);

      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 1 },
      });
      expect(result).toEqual({ message: 'All sessions revoked' });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // getSessions()
  // ─────────────────────────────────────────────────────────────
  describe('getSessions()', () => {
    it('should return paginated sessions for user', async () => {
      const sessions = [
        {
          id: 1,
          userId: 1,
          token: 'hash',
          expiresAt: new Date(),
          createdAt: new Date(),
        },
      ];
      prisma.refreshToken.findMany.mockResolvedValue(sessions as any);
      prisma.refreshToken.count.mockResolvedValue(1);

      const query = {
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc' as const,
      };
      const result = await service.getSessions(1, query);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // revokeSession()
  // ─────────────────────────────────────────────────────────────
  describe('revokeSession()', () => {
    it('should throw NotFoundException if session not found', async () => {
      prisma.refreshToken.findFirst.mockResolvedValue(null);

      await expect(service.revokeSession(1, 99)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should delete the session and return success message', async () => {
      const session = {
        id: 5,
        userId: 1,
        token: 'hash',
        expiresAt: new Date(),
        createdAt: new Date(),
      };
      prisma.refreshToken.findFirst.mockResolvedValue(session as any);
      prisma.refreshToken.delete.mockResolvedValue(session as any);

      const result = await service.revokeSession(1, 5);

      expect(prisma.refreshToken.delete).toHaveBeenCalledWith({
        where: { id: 5 },
      });
      expect(result).toEqual({ message: 'Session revoked' });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // verifyEmail()
  // ─────────────────────────────────────────────────────────────
  describe('verifyEmail()', () => {
    it('should throw UnauthorizedException if token is invalid or expired', async () => {
      prisma.emailVerification.findFirst.mockResolvedValue(null);

      await expect(service.verifyEmail('invalid_token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should verify email, update user and log audit on success', async () => {
      const verification = {
        id: 1,
        userId: 1,
        token: 'hash',
        expiresAt: new Date(Date.now() + 3600000),
      };
      prisma.emailVerification.findFirst.mockResolvedValue(verification as any);
      prisma.$transaction.mockImplementation((ops: any) =>
        Array.isArray(ops) ? Promise.all(ops) : ops(prisma),
      );
      prisma.user.update.mockResolvedValue(mockUser as any);
      prisma.emailVerification.delete.mockResolvedValue(verification as any);

      const result = await service.verifyEmail('valid_raw_token');

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(auditService.log).toHaveBeenCalledWith(
        'email.verified',
        1,
        1,
        'user',
      );
      expect(result).toEqual({ message: 'Email verified successfully' });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // forgotPassword()
  // ─────────────────────────────────────────────────────────────
  describe('forgotPassword()', () => {
    it('should return generic message when user does not exist (security)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.forgotPassword('unknown@example.com');

      expect(mailService.sendPasswordResetEmail).not.toHaveBeenCalled();
      expect(result.message).toContain('If an account');
    });

    it('should create reset token and send email when user exists', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      prisma.passwordReset.deleteMany.mockResolvedValue({ count: 0 });
      prisma.passwordReset.create.mockResolvedValue({} as any);

      const result = await service.forgotPassword('test@example.com');

      expect(prisma.passwordReset.create).toHaveBeenCalledTimes(1);
      expect(mailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        mockUser.email,
        mockUser.name,
        expect.any(String),
      );
      expect(result.message).toContain('If an account');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // resetPassword()
  // ─────────────────────────────────────────────────────────────
  describe('resetPassword()', () => {
    it('should throw UnauthorizedException if reset token is invalid or expired', async () => {
      prisma.passwordReset.findFirst.mockResolvedValue(null);

      await expect(
        service.resetPassword('invalid_token', 'new_password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should update password, revoke all sessions and log audit on success', async () => {
      const resetRecord = {
        id: 1,
        userId: 1,
        token: 'hash',
        expiresAt: new Date(Date.now() + 3600000),
      };
      prisma.passwordReset.findFirst.mockResolvedValue(resetRecord as any);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new_hashed_password');
      prisma.$transaction.mockImplementation((ops: any) =>
        Array.isArray(ops) ? Promise.all(ops) : ops(prisma),
      );
      prisma.user.update.mockResolvedValue(mockUser as any);
      prisma.passwordReset.delete.mockResolvedValue(resetRecord as any);
      prisma.refreshToken.deleteMany.mockResolvedValue({ count: 2 });

      const result = await service.resetPassword('valid_token', 'new_password');

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(auditService.log).toHaveBeenCalledWith(
        'password.reset',
        1,
        1,
        'user',
      );
      expect(result).toEqual({
        message: 'Password reset successfully. Please log in again.',
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // resendVerificationEmail()
  // ─────────────────────────────────────────────────────────────
  describe('resendVerificationEmail()', () => {
    it('should return generic message when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.resendVerificationEmail(
        'unknown@example.com',
      );

      expect(mailService.sendVerificationEmail).not.toHaveBeenCalled();
      expect(result.message).toContain('If an unverified account');
    });

    it('should return generic message when email is already verified', async () => {
      const verifiedUser = { ...mockUser, isEmailChecked: true };
      prisma.user.findUnique.mockResolvedValue(verifiedUser as any);

      const result = await service.resendVerificationEmail('test@example.com');

      expect(mailService.sendVerificationEmail).not.toHaveBeenCalled();
      expect(result.message).toContain('If an unverified account');
    });

    it('should send new verification email for unverified user', async () => {
      const unverifiedUser = { ...mockUser, isEmailChecked: false };
      prisma.user.findUnique.mockResolvedValue(unverifiedUser as any);
      prisma.emailVerification.deleteMany.mockResolvedValue({ count: 1 });
      prisma.emailVerification.create.mockResolvedValue({} as any);

      const result = await service.resendVerificationEmail('test@example.com');

      expect(mailService.sendVerificationEmail).toHaveBeenCalledWith(
        unverifiedUser.email,
        unverifiedUser.name,
        expect.any(String),
      );
      expect(result.message).toContain('If an unverified account');
    });
  });
});
