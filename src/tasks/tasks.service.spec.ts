import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TasksService } from './tasks.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProfilesService } from '../profiles/profiles.service.js';
import { createPrismaServiceMock, PrismaServiceMock } from '../prisma/prisma.service.mock.js';

describe('TasksService', () => {
  let service: TasksService;
  let prisma: PrismaServiceMock;
  let profilesService: jest.Mocked<Pick<ProfilesService, 'deleteUnverified'>>;
  let configService: jest.Mocked<Pick<ConfigService, 'getOrThrow' | 'get'>>;

  beforeEach(async () => {
    prisma = createPrismaServiceMock();

    profilesService = {
      deleteUnverified: jest.fn(),
    };

    configService = {
      getOrThrow: jest.fn(),
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: PrismaService, useValue: prisma },
        { provide: ProfilesService, useValue: profilesService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // cleanupUnverifiedUsers()
  // ─────────────────────────────────────────────────────────────
  describe('cleanupUnverifiedUsers()', () => {
    it('should read TTL from config and call profilesService.deleteUnverified', async () => {
      configService.getOrThrow.mockReturnValue('24' as any);
      profilesService.deleteUnverified.mockResolvedValue(5);

      const result = await service.cleanupUnverifiedUsers();

      expect(configService.getOrThrow).toHaveBeenCalledWith('UNVERIFIED_USER_TTL_HOURS');
      expect(profilesService.deleteUnverified).toHaveBeenCalledWith(24);
      expect(result.message).toContain('5');
    });

    it('should return 0 deleted when no unverified users exist', async () => {
      configService.getOrThrow.mockReturnValue('48' as any);
      profilesService.deleteUnverified.mockResolvedValue(0);

      const result = await service.cleanupUnverifiedUsers();

      expect(result.message).toContain('0');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // cleanupExpiredTokens()
  // ─────────────────────────────────────────────────────────────
  describe('cleanupExpiredTokens()', () => {
    it('should delete expired refresh tokens and password resets', async () => {
      prisma.refreshToken.deleteMany.mockResolvedValue({ count: 3 });
      prisma.passwordReset.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.cleanupExpiredTokens();

      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { expiresAt: { lt: expect.any(Date) } } }),
      );
      expect(prisma.passwordReset.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { expiresAt: { lt: expect.any(Date) } } }),
      );
      expect(result.refreshTokens).toBe(3);
      expect(result.passwordResets).toBe(1);
      expect(result.message).toContain('4');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // cleanupAuditLogs()
  // ─────────────────────────────────────────────────────────────
  describe('cleanupAuditLogs()', () => {
    it('should use explicit days parameter when provided', async () => {
      prisma.auditLog.deleteMany.mockResolvedValue({ count: 10 });

      const result = await service.cleanupAuditLogs(7);

      expect(prisma.auditLog.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { createdAt: { lt: expect.any(Date) } } }),
      );
      expect(result.olderThanDays).toBe(7);
      expect(result.message).toContain('10');
    });

    it('should fall back to AUDIT_LOG_TTL_DAYS from config when no param', async () => {
      configService.get.mockReturnValue('14' as any);
      prisma.auditLog.deleteMany.mockResolvedValue({ count: 5 });

      const result = await service.cleanupAuditLogs();

      expect(configService.get).toHaveBeenCalledWith('AUDIT_LOG_TTL_DAYS');
      expect(result.olderThanDays).toBe(14);
    });

    it('should default to 30 days when AUDIT_LOG_TTL_DAYS is not set', async () => {
      configService.get.mockReturnValue(undefined as any);
      prisma.auditLog.deleteMany.mockResolvedValue({ count: 0 });

      const result = await service.cleanupAuditLogs();

      expect(result.olderThanDays).toBe(30);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // cleanupOrphanedPermissions()
  // ─────────────────────────────────────────────────────────────
  describe('cleanupOrphanedPermissions()', () => {
    it('should return no deleted when no orphaned permissions exist', async () => {
      prisma.permission.findMany.mockResolvedValue([]);

      const result = await service.cleanupOrphanedPermissions();

      expect(result.deleted).toEqual([]);
      expect(result.message).toContain('No orphaned');
      expect(prisma.rolePermission.deleteMany).not.toHaveBeenCalled();
      expect(prisma.permission.deleteMany).not.toHaveBeenCalled();
    });

    it('should delete orphaned permissions and their role links', async () => {
      const orphaned = [
        { id: 10, name: 'obsolete:permission', createdAt: new Date() },
        { id: 11, name: 'old:feature:access', createdAt: new Date() },
      ];
      prisma.permission.findMany.mockResolvedValue(orphaned as any);
      prisma.rolePermission.deleteMany.mockResolvedValue({ count: 2 });
      prisma.permission.deleteMany.mockResolvedValue({ count: 2 });

      const result = await service.cleanupOrphanedPermissions();

      expect(prisma.rolePermission.deleteMany).toHaveBeenCalledWith({
        where: { permissionId: { in: [10, 11] } },
      });
      expect(prisma.permission.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: [10, 11] } },
      });
      expect(result.deleted).toEqual(['obsolete:permission', 'old:feature:access']);
      expect(result.message).toContain('2');
    });
  });
});
