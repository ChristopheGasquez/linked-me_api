import type { Mock, Mocked } from 'vitest';
vi.mock('bcrypt', () => ({
  hash: vi.fn(),
  compare: vi.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { ProfilesService } from './profiles.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { UserCacheService } from '../auth/cache/user-cache.service.js';
import {
  createPrismaServiceMock,
  PrismaServiceMock,
} from '../prisma/prisma.service.mock.js';
import { testId } from '../../../test/setup/test-id.js';

const mockUser = {
  id: testId(1),
  email: 'test@example.com',
  password: 'hashed_password',
  name: 'Test User',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  isEmailChecked: true,
  failedLoginAttempts: 0,
  lockedUntil: null,
};

describe('ProfilesService', () => {
  let service: ProfilesService;
  let prisma: PrismaServiceMock;
  let auditService: Mocked<Pick<AuditService, 'log'>>;
  let eventEmitter: Mocked<Pick<EventEmitter2, 'emitAsync'>>;
  let userCache: Mocked<Pick<UserCacheService, 'invalidate'>>;

  beforeEach(async () => {
    prisma = createPrismaServiceMock();

    auditService = {
      log: vi.fn().mockResolvedValue(undefined),
    };

    eventEmitter = {
      emitAsync: vi.fn().mockResolvedValue([]),
    };

    userCache = {
      invalidate: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfilesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
        { provide: UserCacheService, useValue: userCache },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<ProfilesService>(ProfilesService);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // findOne()
  // ─────────────────────────────────────────────────────────────
  describe('findOne()', () => {
    it('should throw NotFoundException if user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne(testId(99))).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return public fields only (no password)', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);

      const result = await service.findOne(testId(1));

      expect(result).toEqual({
        id: mockUser.id,
        name: mockUser.name,
        email: mockUser.email,
        createdAt: mockUser.createdAt,
      });
      expect(result).not.toHaveProperty('password');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // update()
  // ─────────────────────────────────────────────────────────────
  describe('update()', () => {
    it('should throw NotFoundException if user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.update(testId(99), { name: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update user, log audit and return public fields', async () => {
      const updatedUser = { ...mockUser, name: 'New Name' };
      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      prisma.user.update.mockResolvedValue(updatedUser as any);

      const result = await service.update(testId(1), { name: 'New Name' });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: testId(1) },
        data: { name: 'New Name' },
      });
      expect(auditService.log).toHaveBeenCalledWith(
        'profile.update',
        testId(1),
        testId(1),
        'user',
        expect.any(Object),
      );
      expect(userCache.invalidate).toHaveBeenCalledWith(testId(1));
      expect(result).toMatchObject({ id: testId(1), name: 'New Name' });
      expect(result).not.toHaveProperty('password');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // remove()
  // ─────────────────────────────────────────────────────────────
  describe('remove()', () => {
    it('should throw NotFoundException if user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.remove(testId(99))).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should delete user and log audit', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      prisma.user.delete.mockResolvedValue(mockUser as any);

      const result = await service.remove(testId(1));

      expect(prisma.user.delete).toHaveBeenCalledWith({
        where: { id: testId(1) },
      });
      expect(userCache.invalidate).toHaveBeenCalledWith(testId(1));
      expect(auditService.log).toHaveBeenCalledWith(
        'profile.delete',
        testId(1),
        testId(1),
        'user',
        { email: mockUser.email },
      );
      expect(result).toMatchObject({ code: 'profile.deleted' });
    });

    it('should emit user.deleted after deleting the user', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      prisma.user.delete.mockResolvedValue(mockUser as any);

      await service.remove(testId(1));

      expect(eventEmitter.emitAsync).toHaveBeenCalledWith('user.deleted', {
        userId: testId(1),
      });
      expect(prisma.user.delete.mock.invocationCallOrder[0]).toBeLessThan(
        eventEmitter.emitAsync.mock.invocationCallOrder[0],
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // changePassword()
  // ─────────────────────────────────────────────────────────────
  describe('changePassword()', () => {
    it('should throw NotFoundException if user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.changePassword(testId(99), 'current', 'new'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw UnauthorizedException if current password is wrong', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      (bcrypt.compare as Mock).mockResolvedValue(false);

      await expect(
        service.changePassword(testId(1), 'wrong_password', 'new'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should update password, revoke sessions and log audit on success', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      (bcrypt.compare as Mock).mockResolvedValue(true);
      (bcrypt.hash as Mock).mockResolvedValue('new_hashed_password');
      prisma.$transaction.mockImplementation((ops: any) =>
        Array.isArray(ops) ? Promise.all(ops) : ops(prisma),
      );
      prisma.user.update.mockResolvedValue(mockUser as any);
      prisma.refreshToken.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.changePassword(
        testId(1),
        'current_password',
        'new_password',
      );

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(auditService.log).toHaveBeenCalledWith(
        'profile.password.change',
        testId(1),
        testId(1),
        'user',
      );
      expect(result).toMatchObject({ code: 'profile.password.changed' });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // deleteUnverified()
  // ─────────────────────────────────────────────────────────────
  describe('deleteUnverified()', () => {
    it('should delete unverified users older than TTL and return count', async () => {
      prisma.user.deleteMany.mockResolvedValue({ count: 3 });

      const count = await service.deleteUnverified(24);

      expect(prisma.user.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isEmailChecked: false,
            createdAt: expect.objectContaining({ lt: expect.any(Date) }),
          }),
        }),
      );
      expect(count).toBe(3);
    });
  });
});
