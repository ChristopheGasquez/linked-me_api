import type { Mocked } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminUsersService } from './users.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../../audit/audit.service.js';
import { UserCacheService } from '../../auth/cache/user-cache.service.js';
import {
  createPrismaServiceMock,
  PrismaServiceMock,
} from '../../prisma/prisma.service.mock.js';
import { testId } from '../../../../test/setup/test-id.js';

const mockRole = { id: testId(1), name: 'USER', createdAt: new Date() };

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
  roles: [{ role: mockRole }],
};

const defaultQuery = {
  page: 1,
  limit: 20,
  sortBy: 'createdAt',
  sortOrder: 'desc' as const,
};

describe('AdminUsersService', () => {
  let service: AdminUsersService;
  let prisma: PrismaServiceMock;
  let auditService: Mocked<Pick<AuditService, 'log'>>;
  let userCache: Mocked<Pick<UserCacheService, 'invalidate' | 'invalidateAll'>>;

  beforeEach(async () => {
    prisma = createPrismaServiceMock();

    auditService = {
      log: vi.fn().mockResolvedValue(undefined),
    };

    userCache = {
      invalidate: vi.fn(),
      invalidateAll: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminUsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
        { provide: UserCacheService, useValue: userCache },
      ],
    }).compile();

    service = module.get<AdminUsersService>(AdminUsersService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // findAllUsers()
  // ─────────────────────────────────────────────────────────────
  describe('findAllUsers()', () => {
    it('should return paginated users with password stripped and roles flattened', async () => {
      const usersFromDb = [mockUser];
      prisma.user.findMany.mockResolvedValue(usersFromDb as any);
      prisma.user.count.mockResolvedValue(1);

      const result = await service.findAllUsers(defaultQuery);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).not.toHaveProperty('password');
      expect(result.data[0].roles).toEqual([mockRole]);
      expect(result.meta.total).toBe(1);
    });

    it('should filter by role when role is provided in query', async () => {
      prisma.user.findMany.mockResolvedValue([] as any);
      prisma.user.count.mockResolvedValue(0);

      await service.findAllUsers({ ...defaultQuery, role: 'ADMIN' } as any);

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            roles: { some: { role: { name: 'ADMIN' } } },
          }),
        }),
      );
    });

    it('should filter by isEmailChecked when provided', async () => {
      prisma.user.findMany.mockResolvedValue([] as any);
      prisma.user.count.mockResolvedValue(0);

      await service.findAllUsers({
        ...defaultQuery,
        isEmailChecked: false,
      } as any);

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isEmailChecked: false }),
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findUserById()
  // ─────────────────────────────────────────────────────────────
  describe('findUserById()', () => {
    it('should throw NotFoundException if user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findUserById(testId(99))).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return user with flattened roles and no password', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);

      const result = await service.findUserById(testId(1));

      expect(result).not.toHaveProperty('password');
      expect(result.roles).toEqual([mockRole]);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // addRoleToUser()
  // ─────────────────────────────────────────────────────────────
  describe('addRoleToUser()', () => {
    it('should throw NotFoundException if user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.addRoleToUser(testId(1), testId(99), 'ADMIN'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if role does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      prisma.role.findUnique.mockResolvedValue(null);

      await expect(
        service.addRoleToUser(testId(1), testId(1), 'NONEXISTENT'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if user already has the role', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      prisma.role.findUnique.mockResolvedValue(mockRole as any);
      prisma.userRole.findUnique.mockResolvedValue({
        userId: testId(1),
        roleId: testId(1),
      } as any);

      await expect(
        service.addRoleToUser(testId(1), testId(1), 'USER'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should assign role to user and log audit on success', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      prisma.role.findUnique.mockResolvedValue(mockRole as any);
      prisma.userRole.findUnique.mockResolvedValue(null);
      prisma.userRole.create.mockResolvedValue({} as any);

      const result = await service.addRoleToUser(testId(2), testId(1), 'USER');

      expect(prisma.userRole.create).toHaveBeenCalledWith({
        data: { userId: testId(1), roleId: testId(1) },
      });
      expect(auditService.log).toHaveBeenCalledWith(
        'user.role.assign',
        testId(2),
        testId(1),
        'user',
        { roleName: 'USER' },
      );
      expect(result).toMatchObject({
        code: 'admin.user.role.assigned',
        params: { roleName: 'USER', userId: testId(1) },
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // removeRoleFromUser()
  // ─────────────────────────────────────────────────────────────
  describe('removeRoleFromUser()', () => {
    it('should throw NotFoundException if UserRole link does not exist', async () => {
      prisma.userRole.findUnique.mockResolvedValue(null);

      await expect(
        service.removeRoleFromUser(testId(1), testId(1), testId(1)),
      ).rejects.toThrow(NotFoundException);
    });

    it('should remove role from user and log audit', async () => {
      const link = { userId: testId(1), roleId: testId(1), role: mockRole };
      prisma.userRole.findUnique.mockResolvedValue(link as any);
      prisma.userRole.delete.mockResolvedValue(link as any);

      const result = await service.removeRoleFromUser(
        testId(2),
        testId(1),
        testId(1),
      );

      expect(prisma.userRole.delete).toHaveBeenCalledWith({
        where: { userId_roleId: { userId: testId(1), roleId: testId(1) } },
      });
      expect(auditService.log).toHaveBeenCalledWith(
        'user.role.revoke',
        testId(2),
        testId(1),
        'user',
        { roleName: 'USER' },
      );
      expect(result).toMatchObject({ code: 'admin.user.role.removed' });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // deleteUser()
  // ─────────────────────────────────────────────────────────────
  describe('deleteUser()', () => {
    it('should throw NotFoundException if user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.deleteUser(testId(1), testId(99))).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if user still has roles', async () => {
      const userWithRoles = { ...mockUser, roles: [{ roleId: testId(1) }] };
      prisma.user.findUnique.mockResolvedValue(userWithRoles as any);

      await expect(service.deleteUser(testId(1), testId(1))).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should delete user and log audit when user has no roles', async () => {
      const userNoRoles = { ...mockUser, roles: [] };
      prisma.user.findUnique.mockResolvedValue(userNoRoles as any);
      prisma.user.delete.mockResolvedValue(userNoRoles as any);

      const result = await service.deleteUser(testId(2), testId(1));

      expect(prisma.user.delete).toHaveBeenCalledWith({
        where: { id: testId(1) },
      });
      expect(auditService.log).toHaveBeenCalledWith(
        'user.delete',
        testId(2),
        testId(1),
        'user',
        expect.any(Object),
      );
      expect(result).toMatchObject({
        code: 'admin.user.deleted',
        params: { userId: testId(1) },
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findUserSessions()
  // ─────────────────────────────────────────────────────────────
  describe('findUserSessions()', () => {
    it('should throw NotFoundException if user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.findUserSessions(testId(99), defaultQuery),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.refreshToken.findMany).not.toHaveBeenCalled();
    });

    it('should return the active sessions of the user without the token hash', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: testId(1) } as any);
      prisma.refreshToken.findMany.mockResolvedValue([
        {
          id: testId(7),
          userId: testId(1),
          token: 'hash',
          expiresAt: new Date(),
          createdAt: new Date(),
        },
      ] as any);
      prisma.refreshToken.count.mockResolvedValue(1);

      const result = await service.findUserSessions(testId(1), defaultQuery);

      expect(prisma.refreshToken.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: testId(1), expiresAt: { gt: expect.any(Date) } },
        }),
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).not.toHaveProperty('token');
      expect(result.meta.total).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // revokeUserSession()
  // ─────────────────────────────────────────────────────────────
  describe('revokeUserSession()', () => {
    it('should throw NotFoundException if the session does not belong to the user', async () => {
      prisma.refreshToken.findFirst.mockResolvedValue(null);

      await expect(
        service.revokeUserSession(testId(2), testId(1), testId(99)),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.refreshToken.findFirst).toHaveBeenCalledWith({
        where: { id: testId(99), userId: testId(1) },
      });
      expect(prisma.refreshToken.delete).not.toHaveBeenCalled();
      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('should delete the session and log audit', async () => {
      prisma.refreshToken.findFirst.mockResolvedValue({ id: testId(7) } as any);
      prisma.refreshToken.delete.mockResolvedValue({ id: testId(7) } as any);

      const result = await service.revokeUserSession(
        testId(2),
        testId(1),
        testId(7),
      );

      expect(prisma.refreshToken.delete).toHaveBeenCalledWith({
        where: { id: testId(7) },
      });
      expect(auditService.log).toHaveBeenCalledWith(
        'user.session.revoke',
        testId(2),
        testId(1),
        'user',
        { sessionId: testId(7) },
      );
      expect(result).toMatchObject({
        code: 'admin.user.session.revoked',
        params: { userId: testId(1), sessionId: testId(7) },
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // revokeAllUserSessions()
  // ─────────────────────────────────────────────────────────────
  describe('revokeAllUserSessions()', () => {
    it('should throw NotFoundException if user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.revokeAllUserSessions(testId(2), testId(99)),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should delete all tokens, count only active ones and log audit', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: testId(1) } as any);
      prisma.$transaction.mockImplementation((ops: any) =>
        Array.isArray(ops) ? Promise.all(ops) : ops(prisma),
      );
      prisma.refreshToken.count.mockResolvedValue(2);
      prisma.refreshToken.deleteMany.mockResolvedValue({ count: 3 });

      const result = await service.revokeAllUserSessions(testId(2), testId(1));

      expect(prisma.refreshToken.count).toHaveBeenCalledWith({
        where: { userId: testId(1), expiresAt: { gt: expect.any(Date) } },
      });
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: testId(1) },
      });
      expect(auditService.log).toHaveBeenCalledWith(
        'user.session.revoke_all',
        testId(2),
        testId(1),
        'user',
        { count: 2 },
      );
      expect(result).toMatchObject({
        code: 'admin.user.sessions.revoked',
        params: { userId: testId(1), count: 2 },
      });
    });
  });
});
