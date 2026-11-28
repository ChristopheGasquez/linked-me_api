import type { Mock, Mocked } from 'vitest';
vi.mock('bcrypt', () => ({
  hash: vi.fn(),
  compare: vi.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AuthService } from './auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { AuditService } from '../audit/audit.service.js';
import {
  createPrismaServiceMock,
  PrismaServiceMock,
} from '../prisma/prisma.service.mock.js';
import { testId } from '../../../test/setup/test-id.js';

const DAY = 24 * 60 * 60 * 1000;
const sha256 = (value: string) =>
  crypto.createHash('sha256').update(value).digest('hex');

const mockUser = {
  id: testId(1),
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
  let jwtService: Mocked<JwtService>;
  let mailService: Mocked<
    Pick<
      MailService,
      | 'sendVerificationEmail'
      | 'sendPasswordResetEmail'
      | 'sendAccountLockedEmail'
    >
  >;
  let auditService: Mocked<Pick<AuditService, 'log'>>;
  let configService: { get: Mock };

  beforeEach(async () => {
    prisma = createPrismaServiceMock();

    jwtService = {
      signAsync: vi.fn().mockResolvedValue('mock_token'),
    } as any;

    configService = {
      get: vi.fn((_key: string, fallback?: unknown) => fallback),
    };

    mailService = {
      sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
      sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
      sendAccountLockedEmail: vi.fn().mockResolvedValue(undefined),
    };

    auditService = {
      log: vi.fn().mockResolvedValue(undefined),
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
    vi.resetAllMocks();
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
      (bcrypt.hash as Mock).mockResolvedValue('hashed_password');

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
        testId(1),
        testId(1),
        'user',
        expect.any(Object),
      );
      expect(result).not.toHaveProperty('password');
      expect(result).toMatchObject({
        id: testId(1),
        email: 'test@example.com',
      });
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
      (bcrypt.compare as Mock).mockResolvedValue(false);
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
      (bcrypt.compare as Mock).mockResolvedValue(false);
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
        testId(1),
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
      (bcrypt.compare as Mock).mockResolvedValue(false);
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
      (bcrypt.compare as Mock).mockResolvedValue(true);
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
      (bcrypt.compare as Mock).mockResolvedValue(true);
      prisma.user.update.mockResolvedValue(unverifiedUser as any);

      await expect(
        service.login('test@example.com', 'password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should create a session and return an opaque <sessionId>.<secret> refresh token', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      (bcrypt.compare as Mock).mockResolvedValue(true);
      prisma.user.update.mockResolvedValue(mockUser as any);
      prisma.refreshToken.create.mockResolvedValue({ id: testId(10) } as any);
      prisma.refreshToken.findMany.mockResolvedValue([]);

      const before = Date.now();
      const result = await service.login('test@example.com', 'password');

      expect(result).toMatchObject({
        access_token: 'mock_token',
        user: expect.objectContaining({ id: mockUser.id }),
      });
      const [sessionId, secret] = result.refresh_token.split('.');
      expect(sessionId).toBe(testId(10));
      expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/);

      const { data } = prisma.refreshToken.create.mock.calls[0][0] as any;
      expect(data.tokenHash).toBe(sha256(secret));
      expect(data.userId).toBe(mockUser.id);
      expect(data.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 7 * DAY);
    });

    it('should use REFRESH_TOKEN_TTL_DAYS for the session lifetime', async () => {
      configService.get.mockImplementation((key: string, fallback?: unknown) =>
        key === 'REFRESH_TOKEN_TTL_DAYS' ? '2' : fallback,
      );
      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      (bcrypt.compare as Mock).mockResolvedValue(true);
      prisma.user.update.mockResolvedValue(mockUser as any);
      prisma.refreshToken.create.mockResolvedValue({ id: testId(10) } as any);
      prisma.refreshToken.findMany.mockResolvedValue([]);

      const before = Date.now();
      await service.login('test@example.com', 'password');

      const { data } = prisma.refreshToken.create.mock.calls[0][0] as any;
      const ttl = data.expiresAt.getTime() - before;
      expect(ttl).toBeGreaterThanOrEqual(2 * DAY);
      expect(ttl).toBeLessThan(2 * DAY + 5000);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // session limit (createSession via login)
  // ─────────────────────────────────────────────────────────────
  describe('session limit', () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      (bcrypt.compare as Mock).mockResolvedValue(true);
      prisma.user.update.mockResolvedValue(mockUser as any);
      prisma.refreshToken.create.mockResolvedValue({ id: testId(10) } as any);
    });

    it('should not evict any session when the user has 10 sessions or fewer', async () => {
      prisma.refreshToken.findMany.mockResolvedValue(
        Array.from({ length: 10 }, (_, i) => ({ id: i + 1 })) as any,
      );

      await service.login('test@example.com', 'password');

      expect(prisma.refreshToken.deleteMany).not.toHaveBeenCalled();
    });

    it('should evict the oldest sessions beyond the limit of 10', async () => {
      // findMany is ordered by createdAt asc: ids 1 and 2 are the oldest
      prisma.refreshToken.findMany.mockResolvedValue(
        Array.from({ length: 12 }, (_, i) => ({ id: i + 1 })) as any,
      );

      await service.login('test@example.com', 'password');

      expect(prisma.refreshToken.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: mockUser.id },
          orderBy: { createdAt: 'asc' },
        }),
      );
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: [1, 2] } },
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // callbackUrl validation
  // ─────────────────────────────────────────────────────────────
  describe('callbackUrl validation', () => {
    const allowOrigins = (origins: string) =>
      configService.get.mockImplementation((key: string, fallback?: unknown) =>
        key === 'ALLOWED_REDIRECT_ORIGINS' ? origins : fallback,
      );

    const expectRejected = async (promise: Promise<unknown>) => {
      await expect(promise).rejects.toThrow(BadRequestException);
      await promise.catch((e: BadRequestException) =>
        expect(e.getResponse()).toMatchObject({
          code: 'auth.callback_url.not_allowed',
        }),
      );
    };

    it('should reject a malformed callbackUrl', async () => {
      allowOrigins('https://app.linked-me.test');

      await expectRejected(
        service.forgotPassword('test@example.com', 'not-a-url'),
      );
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should reject an origin that is not in ALLOWED_REDIRECT_ORIGINS', async () => {
      allowOrigins('https://app.linked-me.test');

      await expectRejected(
        service.forgotPassword('test@example.com', 'https://evil.test/reset'),
      );
    });

    it('should reject any callbackUrl when ALLOWED_REDIRECT_ORIGINS is empty', async () => {
      allowOrigins('');

      await expectRejected(
        service.forgotPassword(
          'test@example.com',
          'https://app.linked-me.test/reset',
        ),
      );
    });

    it('should accept an allowed origin (list with spaces) and forward the callbackUrl to the mail', async () => {
      allowOrigins('https://other.test, http://localhost:4200');
      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      prisma.passwordReset.deleteMany.mockResolvedValue({ count: 0 });
      prisma.passwordReset.create.mockResolvedValue({} as any);

      await service.forgotPassword(
        'test@example.com',
        'http://localhost:4200/reset?lang=fr',
      );

      expect(mailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        mockUser.email,
        mockUser.name,
        expect.any(String),
        'http://localhost:4200/reset?lang=fr',
      );
    });

    it('should validate the callbackUrl on register before touching the database', async () => {
      allowOrigins('https://app.linked-me.test');

      await expectRejected(
        service.register({
          email: 'new@example.com',
          password: 'Password1!',
          name: 'New',
          callbackUrl: 'https://evil.test/verify',
        } as any),
      );
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should validate the callbackUrl on resendVerificationEmail', async () => {
      allowOrigins('https://app.linked-me.test');

      await expectRejected(
        service.resendVerificationEmail(
          'test@example.com',
          'https://evil.test/verify',
        ),
      );
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // refresh()
  // ─────────────────────────────────────────────────────────────
  describe('refresh()', () => {
    const SESSION_ID = testId(10);
    const CURRENT = 'current-secret';
    const PREVIOUS = 'previous-secret';
    const token = (secret: string) => `${SESSION_ID}.${secret}`;
    const session = (overrides: Record<string, unknown> = {}) => ({
      id: SESSION_ID,
      userId: mockUser.id,
      tokenHash: sha256(CURRENT),
      previousTokenHash: sha256(PREVIOUS),
      rotatedAt: new Date(Date.now() - 5000),
      expiresAt: new Date(Date.now() + DAY),
      createdAt: new Date(),
      user: { email: mockUser.email },
      ...overrides,
    });
    const expectCode = (promise: Promise<unknown>, code: string) =>
      expect(promise).rejects.toMatchObject({ response: { code } });

    it.each([
      ['a missing cookie', undefined],
      ['a JWT (issued before v3)', 'aaa.bbb.ccc'],
      ['no secret', `${testId(10)}.`],
      ['no separator', 'not-a-token'],
      ['a non UUID v7 session id', '1.secret'],
    ])(
      'should throw invalid token for %s without hitting the DB',
      async (_label, value) => {
        await expectCode(service.refresh(value), 'auth.refresh.invalid_token');
        expect(prisma.refreshToken.findUnique).not.toHaveBeenCalled();
      },
    );

    it('should throw token revoked when the session does not exist', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expectCode(
        service.refresh(token(CURRENT)),
        'auth.refresh.token_revoked',
      );
    });

    it('should throw invalid token when the session is expired', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(
        session({ expiresAt: new Date(Date.now() - 1000) }) as any,
      );

      await expectCode(
        service.refresh(token(CURRENT)),
        'auth.refresh.invalid_token',
      );
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('should rotate the current secret atomically and keep the session id', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(session() as any);
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.refresh(token(CURRENT));

      const [sessionId, secret] = result.refresh_token!.split('.');
      expect(sessionId).toBe(SESSION_ID);
      expect(secret).not.toBe(CURRENT);
      expect(result.access_token).toBe('mock_token');
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
      });
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { id: SESSION_ID, tokenHash: sha256(CURRENT) },
        data: {
          tokenHash: sha256(secret),
          previousTokenHash: sha256(CURRENT),
          rotatedAt: expect.any(Date),
          expiresAt: expect.any(Date),
        },
      });
    });

    it('should re-evaluate when a concurrent request rotated first', async () => {
      prisma.refreshToken.findUnique
        .mockResolvedValueOnce(session() as any)
        .mockResolvedValueOnce(
          session({
            tokenHash: sha256('rotated-by-other-request'),
            previousTokenHash: sha256(CURRENT),
            rotatedAt: new Date(),
          }) as any,
        );
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.refresh(token(CURRENT));

      expect(result).toEqual({ access_token: 'mock_token' });
      expect(prisma.refreshToken.findUnique).toHaveBeenCalledTimes(2);
    });

    it('should return only an access token for the previous secret within 30 s', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(session() as any);

      const result = await service.refresh(token(PREVIOUS));

      expect(result).toEqual({ access_token: 'mock_token' });
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
      expect(prisma.refreshToken.deleteMany).not.toHaveBeenCalled();
    });

    it.each([
      [
        'the previous secret after 30 s',
        PREVIOUS,
        {
          rotatedAt: new Date(Date.now() - 31_000),
        },
      ],
      ['an unknown secret', 'unknown-secret', {}],
      [
        'a secret on a never rotated session',
        PREVIOUS,
        {
          previousTokenHash: null,
          rotatedAt: null,
        },
      ],
    ])(
      'should revoke the session and audit a reuse for %s',
      async (_label, secret, overrides) => {
        prisma.refreshToken.findUnique.mockResolvedValue(
          session(overrides) as any,
        );

        await expectCode(
          service.refresh(token(secret)),
          'auth.refresh.token_reused',
        );
        expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
          where: { id: SESSION_ID },
        });
        expect(auditService.log).toHaveBeenCalledWith(
          'session.reuse_detected',
          null,
          mockUser.id,
          'user',
          { sessionId: SESSION_ID },
        );
      },
    );
  });

  // ─────────────────────────────────────────────────────────────
  // logout()
  // ─────────────────────────────────────────────────────────────
  describe('logout()', () => {
    it('should delete the session matching the current or previous secret', async () => {
      prisma.refreshToken.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.logout(`${testId(10)}.some-secret`);

      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: {
          id: testId(10),
          OR: [
            { tokenHash: sha256('some-secret') },
            { previousTokenHash: sha256('some-secret') },
          ],
        },
      });
      expect(result).toMatchObject({ code: 'auth.logout.success' });
    });

    it.each(['not-a-token', undefined])(
      'should answer success without touching the DB for %s',
      async (value) => {
        const result = await service.logout(value);

        expect(prisma.refreshToken.deleteMany).not.toHaveBeenCalled();
        expect(result).toMatchObject({ code: 'auth.logout.success' });
      },
    );
  });

  // ─────────────────────────────────────────────────────────────
  // logoutAll()
  // ─────────────────────────────────────────────────────────────
  describe('logoutAll()', () => {
    it('should revoke all sessions for the user', async () => {
      prisma.refreshToken.deleteMany.mockResolvedValue({ count: 3 });

      const result = await service.logoutAll(testId(1));

      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: testId(1) },
      });
      expect(result).toMatchObject({ code: 'auth.logout_all.success' });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // getSessions()
  // ─────────────────────────────────────────────────────────────
  describe('getSessions()', () => {
    it('should return paginated sessions for user', async () => {
      const sessions = [
        {
          id: testId(1),
          userId: testId(1),
          tokenHash: 'hash',
          previousTokenHash: 'previous',
          rotatedAt: null,
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
      const result = await service.getSessions(testId(1), query);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).not.toHaveProperty('tokenHash');
      expect(result.data[0]).not.toHaveProperty('previousTokenHash');
      expect(result.data[0]).toHaveProperty('rotatedAt', null);
      expect(result.data[0]).toHaveProperty('current', false);
      expect(result.meta.total).toBe(1);
    });

    it('should flag the session of the refresh cookie as current', async () => {
      prisma.refreshToken.findMany.mockResolvedValue([
        { id: testId(1), userId: testId(1) },
        { id: testId(2), userId: testId(1) },
      ] as any);
      prisma.refreshToken.count.mockResolvedValue(2);

      const result = await service.getSessions(
        testId(1),
        { page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' },
        `${testId(2)}.secret`,
      );

      expect(result.data.map((s) => s.current)).toEqual([false, true]);
    });
  });

  describe('sessionIdOf()', () => {
    it('should return the session id of a well-formed refresh token', () => {
      expect(service.sessionIdOf(`${testId(3)}.secret`)).toBe(testId(3));
    });

    it.each([undefined, '', 'not-a-token'])(
      'should return undefined for %s',
      (value) => {
        expect(service.sessionIdOf(value)).toBeUndefined();
      },
    );
  });

  // ─────────────────────────────────────────────────────────────
  // revokeSession()
  // ─────────────────────────────────────────────────────────────
  describe('revokeSession()', () => {
    it('should throw NotFoundException if session not found', async () => {
      prisma.refreshToken.findFirst.mockResolvedValue(null);

      await expect(
        service.revokeSession(testId(1), testId(99)),
      ).rejects.toThrow(NotFoundException);
    });

    it('should delete the session and return success message', async () => {
      const session = {
        id: testId(5),
        userId: testId(1),
        token: 'hash',
        expiresAt: new Date(),
        createdAt: new Date(),
      };
      prisma.refreshToken.findFirst.mockResolvedValue(session as any);
      prisma.refreshToken.delete.mockResolvedValue(session as any);

      const result = await service.revokeSession(testId(1), testId(5));

      expect(prisma.refreshToken.delete).toHaveBeenCalledWith({
        where: { id: testId(5) },
      });
      expect(result).toMatchObject({ code: 'auth.session.revoked' });
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
        id: testId(1),
        userId: testId(1),
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
        testId(1),
        testId(1),
        'user',
      );
      expect(result).toMatchObject({ code: 'auth.email.verified' });
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
      expect(result).toMatchObject({ code: 'auth.forgot_password.sent' });
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
        undefined,
      );
      expect(result).toMatchObject({ code: 'auth.forgot_password.sent' });
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
        id: testId(1),
        userId: testId(1),
        token: 'hash',
        expiresAt: new Date(Date.now() + 3600000),
      };
      prisma.passwordReset.findFirst.mockResolvedValue(resetRecord as any);
      (bcrypt.hash as Mock).mockResolvedValue('new_hashed_password');
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
        testId(1),
        testId(1),
        'user',
      );
      expect(result).toMatchObject({ code: 'auth.password_reset.success' });
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
      expect(result).toMatchObject({ code: 'auth.email.resend_sent' });
    });

    it('should return generic message when email is already verified', async () => {
      const verifiedUser = { ...mockUser, isEmailChecked: true };
      prisma.user.findUnique.mockResolvedValue(verifiedUser as any);

      const result = await service.resendVerificationEmail('test@example.com');

      expect(mailService.sendVerificationEmail).not.toHaveBeenCalled();
      expect(result).toMatchObject({ code: 'auth.email.resend_sent' });
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
        undefined,
      );
      expect(result).toMatchObject({ code: 'auth.email.resend_sent' });
    });
  });
});
