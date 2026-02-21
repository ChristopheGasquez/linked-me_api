import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminRolesService } from './roles.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../../audit/audit.service.js';
import { createPrismaServiceMock, PrismaServiceMock } from '../../prisma/prisma.service.mock.js';

const mockPermission = { id: 1, name: 'admin:user:read', createdAt: new Date() };

const mockRole = {
  id: 1,
  name: 'ADMIN',
  createdAt: new Date('2024-01-01'),
  permissions: [{ permission: mockPermission }],
};

const defaultQuery = { page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' as const };

describe('AdminRolesService', () => {
  let service: AdminRolesService;
  let prisma: PrismaServiceMock;
  let auditService: jest.Mocked<Pick<AuditService, 'log'>>;

  beforeEach(async () => {
    prisma = createPrismaServiceMock();

    auditService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminRolesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<AdminRolesService>(AdminRolesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // findAllRoles()
  // ─────────────────────────────────────────────────────────────
  describe('findAllRoles()', () => {
    it('should return paginated roles with flattened permissions', async () => {
      prisma.role.findMany.mockResolvedValue([mockRole] as any);
      prisma.role.count.mockResolvedValue(1);

      const result = await service.findAllRoles(defaultQuery);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].permissions).toEqual([mockPermission]);
      expect(result.meta.total).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findRoleById()
  // ─────────────────────────────────────────────────────────────
  describe('findRoleById()', () => {
    it('should throw NotFoundException if role does not exist', async () => {
      prisma.role.findUnique.mockResolvedValue(null);

      await expect(service.findRoleById(99)).rejects.toThrow(NotFoundException);
    });

    it('should return role with flattened permissions', async () => {
      prisma.role.findUnique.mockResolvedValue(mockRole as any);

      const result = await service.findRoleById(1);

      expect(result.name).toBe('ADMIN');
      expect(result.permissions).toEqual([mockPermission]);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // createRole()
  // ─────────────────────────────────────────────────────────────
  describe('createRole()', () => {
    it('should throw BadRequestException if role already exists', async () => {
      prisma.role.findUnique.mockResolvedValue(mockRole as any);

      await expect(service.createRole(1, 'ADMIN')).rejects.toThrow(BadRequestException);
    });

    it('should create role and log audit on success', async () => {
      const newRole = { id: 2, name: 'MODERATOR', createdAt: new Date() };
      prisma.role.findUnique.mockResolvedValue(null);
      prisma.role.create.mockResolvedValue(newRole as any);

      const result = await service.createRole(1, 'MODERATOR');

      expect(prisma.role.create).toHaveBeenCalledWith({ data: { name: 'MODERATOR' } });
      expect(auditService.log).toHaveBeenCalledWith('role.create', 1, 2, 'role', { name: 'MODERATOR' });
      expect(result.name).toBe('MODERATOR');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // deleteRole()
  // ─────────────────────────────────────────────────────────────
  describe('deleteRole()', () => {
    it('should throw NotFoundException if role does not exist', async () => {
      prisma.role.findUnique.mockResolvedValue(null);

      await expect(service.deleteRole(1, 99)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if role is still assigned to users', async () => {
      prisma.role.findUnique.mockResolvedValue(mockRole as any);
      prisma.userRole.count.mockResolvedValue(3);

      await expect(service.deleteRole(1, 1)).rejects.toThrow(BadRequestException);
    });

    it('should delete role and log audit when no users assigned', async () => {
      const roleToDelete = { id: 2, name: 'MODERATOR', createdAt: new Date() };
      prisma.role.findUnique.mockResolvedValue(roleToDelete as any);
      prisma.userRole.count.mockResolvedValue(0);
      prisma.role.delete.mockResolvedValue(roleToDelete as any);

      const result = await service.deleteRole(1, 2);

      expect(prisma.role.delete).toHaveBeenCalledWith({ where: { id: 2 } });
      expect(auditService.log).toHaveBeenCalledWith('role.delete', 1, 2, 'role', { name: 'MODERATOR' });
      expect(result.message).toContain('MODERATOR');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // addPermissionsToRole()
  // ─────────────────────────────────────────────────────────────
  describe('addPermissionsToRole()', () => {
    it('should throw NotFoundException if role does not exist', async () => {
      prisma.role.findUnique.mockResolvedValue(null);

      await expect(service.addPermissionsToRole(1, 99, ['admin:user:read'])).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if some permissions are unknown', async () => {
      const roleWithoutPermissions = { ...mockRole, permissions: [] };
      prisma.role.findUnique.mockResolvedValueOnce(roleWithoutPermissions as any);
      prisma.permission.findMany.mockResolvedValue([]);

      await expect(
        service.addPermissionsToRole(1, 1, ['unknown:permission']),
      ).rejects.toThrow(BadRequestException);
    });

    it('should upsert permissions, log audit and return updated role', async () => {
      const roleWithoutPermissions = { ...mockRole, permissions: [] };
      prisma.role.findUnique.mockResolvedValueOnce(roleWithoutPermissions as any);
      prisma.permission.findMany.mockResolvedValue([mockPermission] as any);
      prisma.rolePermission.upsert.mockResolvedValue({} as any);
      prisma.role.findUnique.mockResolvedValueOnce(mockRole as any);

      const result = await service.addPermissionsToRole(1, 1, ['admin:user:read']);

      expect(prisma.rolePermission.upsert).toHaveBeenCalledTimes(1);
      expect(auditService.log).toHaveBeenCalledWith(
        'role.permission.assign',
        1,
        1,
        'role',
        expect.any(Object),
      );
      expect(result.permissions).toEqual([mockPermission]);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // removePermissionFromRole()
  // ─────────────────────────────────────────────────────────────
  describe('removePermissionFromRole()', () => {
    it('should throw NotFoundException if permission not assigned to role', async () => {
      prisma.rolePermission.findUnique.mockResolvedValue(null);

      await expect(service.removePermissionFromRole(1, 1, 99)).rejects.toThrow(NotFoundException);
    });

    it('should remove permission from role and log audit', async () => {
      const link = { roleId: 1, permissionId: 1, role: { name: 'ADMIN' }, permission: mockPermission };
      prisma.rolePermission.findUnique.mockResolvedValue(link as any);
      prisma.rolePermission.delete.mockResolvedValue(link as any);

      const result = await service.removePermissionFromRole(1, 1, 1);

      expect(prisma.rolePermission.delete).toHaveBeenCalledWith({
        where: { roleId_permissionId: { roleId: 1, permissionId: 1 } },
      });
      expect(auditService.log).toHaveBeenCalledWith(
        'role.permission.revoke',
        1,
        1,
        'role',
        expect.any(Object),
      );
      expect(result).toEqual({ message: 'Permission removed from role' });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findAllPermissions()
  // ─────────────────────────────────────────────────────────────
  describe('findAllPermissions()', () => {
    it('should return paginated permissions', async () => {
      prisma.permission.findMany.mockResolvedValue([mockPermission] as any);
      prisma.permission.count.mockResolvedValue(1);

      const result = await service.findAllPermissions(defaultQuery);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });
});
