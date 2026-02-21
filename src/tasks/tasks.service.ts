import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProfilesService } from '../profiles/profiles.service.js';
import { Permissions } from '../auth/permissions.constants.js';
import { MS_PER_DAY } from '../common/constants.js';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private profilesService: ProfilesService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  @Cron('0 */6 * * *')
  async cleanupUnverifiedUsers() {
    const ttl = +this.configService.getOrThrow<string>(
      'UNVERIFIED_USER_TTL_HOURS',
    );
    const count = await this.profilesService.deleteUnverified(ttl);
    if (count > 0) {
      this.logger.log(`Deleted ${count} unverified user(s)`);
    }
    return { message: `${count} unverified account(s) deleted` };
  }

  @Cron('0 2 * * *')
  async cleanupExpiredTokens() {
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
    return {
      message: `${total} expired token(s) deleted`,
      refreshTokens: refreshResult.count,
      passwordResets: resetResult.count,
    };
  }

  @Cron('0 3 * * *')
  async cleanupAuditLogs(olderThanDays?: number) {
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
    return {
      message: `${result.count} audit log(s) deleted`,
      olderThanDays: days,
    };
  }

  async cleanupOrphanedPermissions() {
    const valid = Object.values(Permissions) as string[];
    const orphaned = await this.prisma.permission.findMany({
      where: { name: { notIn: valid } },
    });

    if (orphaned.length === 0) {
      return { message: 'No orphaned permissions found', deleted: [] };
    }

    const ids = orphaned.map((p) => p.id);
    await this.prisma.rolePermission.deleteMany({
      where: { permissionId: { in: ids } },
    });
    await this.prisma.permission.deleteMany({ where: { id: { in: ids } } });

    return {
      message: `${orphaned.length} orphaned permission(s) deleted`,
      deleted: orphaned.map((p) => p.name),
    };
  }
}
