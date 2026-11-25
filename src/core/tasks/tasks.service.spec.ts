import type { Mock, Mocked } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TasksService } from './tasks.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProfilesService } from '../profiles/profiles.service.js';
import { AuditService } from '../audit/audit.service.js';
import {
  createPrismaServiceMock,
  PrismaServiceMock,
} from '../prisma/prisma.service.mock.js';
import { testId } from '../../../test/setup/test-id.js';

describe('TasksService', () => {
  let service: TasksService;
  let prisma: PrismaServiceMock;
  let profilesService: Mocked<Pick<ProfilesService, 'deleteUnverified'>>;
  let configService: { getOrThrow: Mock; get: Mock };
  let auditService: Mocked<Pick<AuditService, 'log'>>;

  beforeEach(async () => {
    prisma = createPrismaServiceMock();

    profilesService = {
      deleteUnverified: vi.fn(),
    };

    configService = {
      getOrThrow: vi.fn(),
      get: vi.fn(),
    };

    auditService = {
      log: vi.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: PrismaService, useValue: prisma },
        { provide: ProfilesService, useValue: profilesService },
        { provide: ConfigService, useValue: configService },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // cleanupUnverifiedUsers()
  // ─────────────────────────────────────────────────────────────
  describe('cleanupUnverifiedUsers()', () => {
    it('should read TTL from config and call profilesService.deleteUnverified', async () => {
      configService.getOrThrow.mockReturnValue('24' as any);
      profilesService.deleteUnverified.mockResolvedValue(5);

      const result = await service.cleanupUnverifiedUsers();

      expect(configService.getOrThrow).toHaveBeenCalledWith(
        'UNVERIFIED_USER_TTL_HOURS',
      );
      expect(profilesService.deleteUnverified).toHaveBeenCalledWith(24);
      expect(result).toMatchObject({
        code: 'task.cleanup.unverified_users.done',
        params: { count: 5 },
      });
    });

    it('should return 0 deleted when no unverified users exist', async () => {
      configService.getOrThrow.mockReturnValue('48' as any);
      profilesService.deleteUnverified.mockResolvedValue(0);

      const result = await service.cleanupUnverifiedUsers();

      expect(result).toMatchObject({ params: { count: 0 } });
    });

    it('should log audit with actorId null when called by cron', async () => {
      configService.getOrThrow.mockReturnValue('24' as any);
      profilesService.deleteUnverified.mockResolvedValue(3);

      await service.cleanupUnverifiedUsers();

      expect(auditService.log).toHaveBeenCalledWith(
        'task.cleanup.unverified-users',
        null,
        null,
        'task',
        { count: 3, ttlHours: 24 },
      );
    });

    it('should log audit with actorId when called manually', async () => {
      configService.getOrThrow.mockReturnValue('24' as any);
      profilesService.deleteUnverified.mockResolvedValue(2);

      await service.cleanupUnverifiedUsers(testId(42));

      expect(auditService.log).toHaveBeenCalledWith(
        'task.cleanup.unverified-users',
        testId(42),
        null,
        'task',
        expect.any(Object),
      );
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
        expect.objectContaining({
          where: { expiresAt: { lt: expect.any(Date) } },
        }),
      );
      expect(prisma.passwordReset.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { expiresAt: { lt: expect.any(Date) } },
        }),
      );
      expect(result).toMatchObject({
        code: 'task.cleanup.expired_tokens.done',
        params: { count: 4, refreshTokens: 3, passwordResets: 1 },
      });
    });

    it('should log audit with counts', async () => {
      prisma.refreshToken.deleteMany.mockResolvedValue({ count: 3 });
      prisma.passwordReset.deleteMany.mockResolvedValue({ count: 1 });

      await service.cleanupExpiredTokens(testId(7));

      expect(auditService.log).toHaveBeenCalledWith(
        'task.cleanup.expired-tokens',
        testId(7),
        null,
        'task',
        { count: 4, refreshTokens: 3, passwordResets: 1 },
      );
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
        expect.objectContaining({
          where: { createdAt: { lt: expect.any(Date) } },
        }),
      );
      expect(result).toMatchObject({ params: { count: 10, olderThanDays: 7 } });
    });

    it('should fall back to AUDIT_LOG_TTL_DAYS from config when no param', async () => {
      configService.get.mockReturnValue('14' as any);
      prisma.auditLog.deleteMany.mockResolvedValue({ count: 5 });

      const result = await service.cleanupAuditLogs();

      expect(configService.get).toHaveBeenCalledWith('AUDIT_LOG_TTL_DAYS');
      expect(result).toMatchObject({ params: { olderThanDays: 14 } });
    });

    it('should default to 30 days when AUDIT_LOG_TTL_DAYS is not set', async () => {
      configService.get.mockReturnValue(undefined as any);
      prisma.auditLog.deleteMany.mockResolvedValue({ count: 0 });

      const result = await service.cleanupAuditLogs();

      expect(result).toMatchObject({ params: { olderThanDays: 30 } });
    });

    it('should log audit with count and olderThanDays', async () => {
      prisma.auditLog.deleteMany.mockResolvedValue({ count: 10 });

      await service.cleanupAuditLogs(7, testId(99));

      expect(auditService.log).toHaveBeenCalledWith(
        'task.cleanup.audit-logs',
        testId(99),
        null,
        'task',
        { count: 10, olderThanDays: 7 },
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // cleanupOrphanedPermissions()
  // ─────────────────────────────────────────────────────────────
  describe('cleanupOrphanedPermissions()', () => {
    it('should return no deleted when no orphaned permissions exist', async () => {
      prisma.permission.findMany.mockResolvedValue([]);

      const result = await service.cleanupOrphanedPermissions();

      expect(result).toMatchObject({
        code: 'task.cleanup.orphaned_permissions.none_found',
        params: { count: 0, deleted: [] },
      });
      expect(prisma.rolePermission.deleteMany).not.toHaveBeenCalled();
      expect(prisma.permission.deleteMany).not.toHaveBeenCalled();
    });

    it('should log audit with count 0 when no orphaned permissions', async () => {
      prisma.permission.findMany.mockResolvedValue([]);

      await service.cleanupOrphanedPermissions(testId(5));

      expect(auditService.log).toHaveBeenCalledWith(
        'task.cleanup.orphaned-permissions',
        testId(5),
        null,
        'task',
        { count: 0, deleted: [] },
      );
    });

    it('should delete orphaned permissions and their role links', async () => {
      const orphaned = [
        { id: testId(10), name: 'obsolete:permission', createdAt: new Date() },
        { id: testId(11), name: 'old:feature:access', createdAt: new Date() },
      ];
      prisma.permission.findMany.mockResolvedValue(orphaned as any);
      prisma.rolePermission.deleteMany.mockResolvedValue({ count: 2 });
      prisma.permission.deleteMany.mockResolvedValue({ count: 2 });

      const result = await service.cleanupOrphanedPermissions();

      expect(prisma.rolePermission.deleteMany).toHaveBeenCalledWith({
        where: { permissionId: { in: [testId(10), testId(11)] } },
      });
      expect(prisma.permission.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: [testId(10), testId(11)] } },
      });
      expect(result).toMatchObject({
        params: {
          count: 2,
          deleted: ['obsolete:permission', 'old:feature:access'],
        },
      });
    });

    it('should log audit with deleted permission names', async () => {
      const orphaned = [
        { id: testId(10), name: 'obsolete:permission', createdAt: new Date() },
      ];
      prisma.permission.findMany.mockResolvedValue(orphaned as any);
      prisma.rolePermission.deleteMany.mockResolvedValue({ count: 1 });
      prisma.permission.deleteMany.mockResolvedValue({ count: 1 });

      await service.cleanupOrphanedPermissions(testId(3));

      expect(auditService.log).toHaveBeenCalledWith(
        'task.cleanup.orphaned-permissions',
        testId(3),
        null,
        'task',
        { count: 1, deleted: ['obsolete:permission'] },
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findAll()
  // ─────────────────────────────────────────────────────────────
  describe('findAll()', () => {
    const ALL_PERMISSIONS = [
      'task:clean-users',
      'task:clean-tokens',
      'task:clean-audit',
      'task:clean-permissions',
    ];

    beforeEach(() => {
      configService.getOrThrow.mockReturnValue('24');
      configService.get.mockReturnValue('45');
      prisma.auditLog.findFirst.mockResolvedValue(null);
    });

    it('should list the 4 tasks in a stable order with schedule and config', async () => {
      const { data } = await service.findAll(ALL_PERMISSIONS);

      expect(data.map((task) => task.name)).toEqual([
        'unverified-users',
        'expired-tokens',
        'audit-logs',
        'orphaned-permissions',
      ]);
      expect(data[0]).toMatchObject({
        permission: 'task:clean-users',
        schedule: { cron: '0 */6 * * *', automatic: true },
        config: { ttlHours: 24 },
      });
      expect(data[1]).toMatchObject({
        schedule: { cron: '0 2 * * *', automatic: true },
        config: {},
      });
      expect(data[2]).toMatchObject({
        schedule: { cron: '0 3 * * *', automatic: true },
        config: { retentionDays: 45 },
      });
      expect(data[3]).toMatchObject({
        schedule: { cron: null, automatic: false },
        config: {},
      });
      expect(data[0]).not.toHaveProperty('action');
    });

    it('should default the audit log retention to 30 days', async () => {
      configService.get.mockReturnValue(undefined);

      const { data } = await service.findAll([]);

      expect(data[2].config).toEqual({ retentionDays: 30 });
    });

    it('should set canRun from the permissions of the user', async () => {
      const { data } = await service.findAll(['task:clean-tokens']);

      expect(data.map((task) => task.canRun)).toEqual([
        false,
        true,
        false,
        false,
      ]);
    });

    it('should return lastRun null when the task never ran', async () => {
      const { data } = await service.findAll(ALL_PERMISSIONS);

      expect(data.every((task) => task.lastRun === null)).toBe(true);
    });

    it('should build lastRun from the latest audit log of each task (cron or manual)', async () => {
      const cronRun = {
        id: testId(1),
        action: 'task.cleanup.unverified-users',
        actorId: null,
        targetId: null,
        targetType: 'task',
        metadata: { count: 2, ttlHours: 24 },
        createdAt: new Date('2026-11-24T06:00:00Z'),
      };
      const manualRun = {
        ...cronRun,
        id: testId(2),
        action: 'task.cleanup.expired-tokens',
        actorId: testId(7),
        metadata: { count: 0, refreshTokens: 0, passwordResets: 0 },
      };
      prisma.auditLog.findFirst
        .mockResolvedValueOnce(cronRun as any)
        .mockResolvedValueOnce(manualRun as any);

      const { data } = await service.findAll(ALL_PERMISSIONS);

      expect(prisma.auditLog.findFirst).toHaveBeenCalledWith({
        where: { action: 'task.cleanup.unverified-users' },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      expect(data[0].lastRun).toEqual({
        at: cronRun.createdAt,
        actorId: null,
        result: { count: 2, ttlHours: 24 },
      });
      expect(data[1].lastRun).toEqual({
        at: manualRun.createdAt,
        actorId: testId(7),
        result: { count: 0, refreshTokens: 0, passwordResets: 0 },
      });
    });
  });
});
