import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { FindAuditLogsQueryDto } from './dto/find-audit-logs-query.dto.js';
import { paginate } from '../../common/pagination/index.js';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(
    action: string,
    actorId: number | null,
    targetId: number | null,
    targetType: string | null,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        action,
        actorId,
        targetId,
        targetType,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  }

  async findAll(query: FindAuditLogsQueryDto) {
    const where: Record<string, unknown> = {};
    if (query.action) where.action = query.action;
    if (query.actorId) where.actorId = query.actorId;
    if (query.targetType) where.targetType = query.targetType;

    return paginate(this.prisma.auditLog, query, { where });
  }
}
