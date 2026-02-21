import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProfilesService } from '../profiles/profiles.service.js';
import { AuditService } from '../audit/audit.service.js';
import { Permissions } from '../auth/permissions.constants.js';
import { MS_PER_DAY } from '../common/constants.js';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private profilesService: ProfilesService,
    private configService: ConfigService,
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  @Cron('0 */6 * * *')
  async cleanupUnverifiedUsers(actorId: number | null = null) {
    const ttl = +this.configService.getOrThrow<string>(
      'UNVERIFIED_USER_TTL_HOURS',
    );
    const count = await this.profilesService.deleteUnverified(ttl);
    if (count > 0) {
      this.logger.log(`Deleted ${count} unverified user(s)`);
    }
    await this.auditService.log(
      'task.cleanup.unverified-users',
      actorId,
      null,
      'task',
      { count, ttlHours: ttl },
    );
    return { message: `${count} unverified account(s) deleted` };
  }

  @Cron('0 2 * * *')
  async cleanupExpiredTokens(actorId: number | null = null) {
    const now = new Date();
    const [refreshResult, resetResult] = await Promise.all([
      this.prisma.refreshToken.deleteMany({
        where: { expiresAt: { lt: now } },
      }),
      this.prisma.passwordReset.deleteMany({
        where: { expiresAt: { lt: now } },
      }),
    ]);
    const total = refreshResult.count + resetResult.count;
    if (total > 0) {
      this.logger.log(
        `Deleted ${refreshResult.count} expired refresh token(s), ${resetResult.count} expired password reset(s)`,
      );
    }
    await this.auditService.log(
      'task.cleanup.expired-tokens',
      actorId,
      null,
      'task',
      { refreshTokens: refreshResult.count, passwordResets: resetResult.count },
    );
    return {
      message: `${total} expired token(s) deleted`,
      refreshTokens: refreshResult.count,
      passwordResets: resetResult.count,
    };
  }

  @Cron('0 3 * * *')
  async cleanupAuditLogs(
    olderThanDays?: number,
    actorId: number | null = null,
  ) {
    const days =
      olderThanDays ??
      +(this.configService.get<string>('AUDIT_LOG_TTL_DAYS') ?? '30');
    const cutoff = new Date(Date.now() - days * MS_PER_DAY);
    const result = await this.prisma.auditLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    if (result.count > 0) {
      this.logger.log(
        `Deleted ${result.count} audit log(s) older than ${days} days`,
      );
    }
    await this.auditService.log(
      'task.cleanup.audit-logs',
      actorId,
      null,
      'task',
      { count: result.count, olderThanDays: days },
    );
    return {
      message: `${result.count} audit log(s) deleted`,
      olderThanDays: days,
    };
  }

  async cleanupOrphanedPermissions(actorId: number | null = null) {
    const valid = Object.values(Permissions) as string[];
    const orphaned = await this.prisma.permission.findMany({
      where: { name: { notIn: valid } },
    });

    if (orphaned.length === 0) {
      await this.auditService.log(
        'task.cleanup.orphaned-permissions',
        actorId,
        null,
        'task',
        { count: 0, deleted: [] },
      );
      return { message: 'No orphaned permissions found', deleted: [] };
    }

    const ids = orphaned.map((p) => p.id);
    await this.prisma.rolePermission.deleteMany({
      where: { permissionId: { in: ids } },
    });
    await this.prisma.permission.deleteMany({ where: { id: { in: ids } } });

    await this.auditService.log(
      'task.cleanup.orphaned-permissions',
      actorId,
      null,
      'task',
      { count: orphaned.length, deleted: orphaned.map((p) => p.name) },
    );
    return {
      message: `${orphaned.length} orphaned permission(s) deleted`,
      deleted: orphaned.map((p) => p.name),
    };
  }
}
