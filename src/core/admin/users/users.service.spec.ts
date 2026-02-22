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

const mockRole = { id: 1, name: 'USER', createdAt: new Date() };

const mockUser = {
  id: 1,
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
  let auditService: jest.Mocked<Pick<AuditService, 'log'>>;
  let userCache: jest.Mocked<
    Pick<UserCacheService, 'invalidate' | 'invalidateAll'>
  >;

  beforeEach(async () => {
    prisma = createPrismaServiceMock();

    auditService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    userCache = {
      invalidate: jest.fn(),
      invalidateAll: jest.fn(),
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
    jest.clearAllMocks();
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

      await expect(service.findUserById(99)).rejects.toThrow(NotFoundException);
    });

    it('should return user with flattened roles and no password', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);

      const result = await service.findUserById(1);

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

      await expect(service.addRoleToUser(1, 99, 'ADMIN')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if role does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      prisma.role.findUnique.mockResolvedValue(null);

      await expect(service.addRoleToUser(1, 1, 'NONEXISTENT')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if user already has the role', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      prisma.role.findUnique.mockResolvedValue(mockRole as any);
      prisma.userRole.findUnique.mockResolvedValue({
        userId: 1,
        roleId: 1,
      } as any);

      await expect(service.addRoleToUser(1, 1, 'USER')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should assign role to user and log audit on success', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      prisma.role.findUnique.mockResolvedValue(mockRole as any);
      prisma.userRole.findUnique.mockResolvedValue(null);
      prisma.userRole.create.mockResolvedValue({} as any);

      const result = await service.addRoleToUser(2, 1, 'USER');

      expect(prisma.userRole.create).toHaveBeenCalledWith({
        data: { userId: 1, roleId: 1 },
      });
      expect(auditService.log).toHaveBeenCalledWith(
        'user.role.assign',
        2,
        1,
        'user',
        { roleName: 'USER' },
      );
      expect(result.message).toContain('assigned');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // removeRoleFromUser()
  // ─────────────────────────────────────────────────────────────
  describe('removeRoleFromUser()', () => {
    it('should throw NotFoundException if UserRole link does not exist', async () => {
      prisma.userRole.findUnique.mockResolvedValue(null);

      await expect(service.removeRoleFromUser(1, 1, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should remove role from user and log audit', async () => {
      const link = { userId: 1, roleId: 1, role: mockRole };
      prisma.userRole.findUnique.mockResolvedValue(link as any);
      prisma.userRole.delete.mockResolvedValue(link as any);

      const result = await service.removeRoleFromUser(2, 1, 1);

      expect(prisma.userRole.delete).toHaveBeenCalledWith({
        where: { userId_roleId: { userId: 1, roleId: 1 } },
      });
      expect(auditService.log).toHaveBeenCalledWith(
        'user.role.revoke',
        2,
        1,
        'user',
        { roleName: 'USER' },
      );
      expect(result).toEqual({ message: 'Role removed from user' });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // deleteUser()
  // ─────────────────────────────────────────────────────────────
  describe('deleteUser()', () => {
    it('should throw NotFoundException if user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.deleteUser(1, 99)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if user still has roles', async () => {
      const userWithRoles = { ...mockUser, roles: [{ roleId: 1 }] };
      prisma.user.findUnique.mockResolvedValue(userWithRoles as any);

      await expect(service.deleteUser(1, 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should delete user and log audit when user has no roles', async () => {
      const userNoRoles = { ...mockUser, roles: [] };
      prisma.user.findUnique.mockResolvedValue(userNoRoles as any);
      prisma.user.delete.mockResolvedValue(userNoRoles as any);

      const result = await service.deleteUser(2, 1);

      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(auditService.log).toHaveBeenCalledWith(
        'user.delete',
        2,
        1,
        'user',
        expect.any(Object),
      );
      expect(result.message).toContain('deleted');
    });
  });
});
