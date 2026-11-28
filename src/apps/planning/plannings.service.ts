import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { paginate } from '../../common/pagination/index.js';
import { PlanningConstants as C } from './planning.constants.js';
import { PlanningResponseCodes as Codes } from './planning.response-codes.js';
import { eventSlotError, planningDays } from './planning-rules.js';
import {
  planningBadRequest,
  planningConflict,
  planningNotFound,
} from './planning-errors.js';
import { planningDetailSelect } from './planning.selects.js';
import type {
  CreatePlanningDto,
  UpdatePlanningDto,
} from './dto/planning.dto.js';
import type { FindPlanningsQueryDto } from './dto/find-plannings-query.dto.js';

type Frame = Pick<
  CreatePlanningDto,
  'name' | 'firstDay' | 'dayCount' | 'startMinute' | 'endMinute'
>;

const frameData = (dto: Frame): Frame => ({
  name: dto.name,
  firstDay: dto.firstDay,
  dayCount: dto.dayCount,
  startMinute: dto.startMinute,
  endMinute: dto.endMinute,
});

@Injectable()
export class PlanningsService {
  constructor(private prisma: PrismaService) {}

  async findAll(ownerId: string, query: FindPlanningsQueryDto) {
    const result = await paginate(this.prisma.planning, query, {
      where: { ownerId },
    });
    return {
      ...result,
      data: result.data.map(({ ownerId: _ownerId, ...planning }) => planning),
    };
  }

  async findOne(ownerId: string, id: string) {
    const planning = await this.prisma.planning.findFirst({
      where: { id, ownerId },
      select: planningDetailSelect,
    });
    if (!planning) throw planningNotFound();
    return planning;
  }

  async create(ownerId: string, dto: CreatePlanningDto) {
    this.assertTimeRange(dto);
    const events = dto.events ?? [];
    events.forEach((event, index) => {
      if (
        event.categoryIndex != null &&
        event.categoryIndex >= dto.categories.length
      ) {
        throw planningBadRequest(Codes.PLANNING_CATEGORY_NOT_IN_PLANNING, {
          index,
        });
      }
      const error = eventSlotError(event, dto);
      if (error) throw planningBadRequest(error, { index });
    });

    const count = await this.prisma.planning.count({ where: { ownerId } });
    if (count >= C.MAX_PLANNINGS_PER_USER) {
      throw planningConflict(Codes.PLANNING_LIMIT_PLANNINGS, {
        max: C.MAX_PLANNINGS_PER_USER,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const planning = await tx.planning.create({
        data: {
          ...frameData(dto),
          ownerId,
          categories: {
            create: dto.categories.map((c, position) => ({
              name: c.name,
              color: c.color,
              position,
            })),
          },
        },
        select: {
          id: true,
          categories: { select: { id: true }, orderBy: { position: 'asc' } },
        },
      });

      if (events.length > 0) {
        await tx.planningEvent.createMany({
          data: events.map((e) => ({
            planningId: planning.id,
            categoryId:
              e.categoryIndex != null
                ? planning.categories[e.categoryIndex].id
                : null,
            day: e.day,
            startMinute: e.startMinute,
            endMinute: e.endMinute,
            title: e.title,
            location: e.location ?? null,
            description: e.description ?? null,
          })),
        });
      }

      return tx.planning.findUniqueOrThrow({
        where: { id: planning.id },
        select: planningDetailSelect,
      });
    });
  }

  async update(ownerId: string, id: string, dto: UpdatePlanningDto) {
    this.assertTimeRange(dto);

    return this.prisma.$transaction(async (tx) => {
      const planning = await tx.planning.findFirst({
        where: { id, ownerId },
        select: { id: true, categories: { select: { id: true } } },
      });
      if (!planning) throw planningNotFound();

      const existingIds = new Set(planning.categories.map((c) => c.id));
      dto.categories.forEach((c, index) => {
        if (c.id && !existingIds.has(c.id)) {
          throw planningBadRequest(Codes.PLANNING_CATEGORY_NOT_IN_PLANNING, {
            index,
          });
        }
      });

      const keptIds = dto.categories.flatMap((c) => (c.id ? [c.id] : []));
      // events of a removed category become "Non défini" (FK ON DELETE SET NULL)
      await tx.planningCategory.deleteMany({
        where: { planningId: id, id: { notIn: keptIds } },
      });
      for (const [position, c] of dto.categories.entries()) {
        const data = { name: c.name, color: c.color, position };
        if (c.id) {
          await tx.planningCategory.update({ where: { id: c.id }, data });
        } else {
          await tx.planningCategory.create({
            data: { ...data, planningId: id },
          });
        }
      }

      await this.fitEventsToFrame(tx, id, dto);

      return tx.planning.update({
        where: { id },
        data: frameData(dto),
        select: planningDetailSelect,
      });
    });
  }

  async remove(ownerId: string, id: string) {
    // categories and events are deleted by FK cascade
    const { count } = await this.prisma.planning.deleteMany({
      where: { id, ownerId },
    });
    if (count === 0) throw planningNotFound();
    return { message: 'Planning deleted', code: Codes.PLANNING_DELETED };
  }

  async removeAllOfOwner(ownerId: string) {
    await this.prisma.planning.deleteMany({ where: { ownerId } });
  }

  private assertTimeRange(dto: Frame) {
    if (dto.endMinute <= dto.startMinute) {
      throw planningBadRequest(Codes.PLANNING_INVALID_TIME_RANGE);
    }
  }

  // Removed days and events fully outside the range are deleted,
  // events partly outside the range are clipped to it
  private async fitEventsToFrame(
    tx: Prisma.TransactionClient,
    planningId: string,
    frame: Frame,
  ) {
    await tx.planningEvent.deleteMany({
      where: {
        planningId,
        OR: [
          { day: { notIn: planningDays(frame) } },
          { endMinute: { lte: frame.startMinute } },
          { startMinute: { gte: frame.endMinute } },
        ],
      },
    });
    await tx.planningEvent.updateMany({
      where: { planningId, startMinute: { lt: frame.startMinute } },
      data: { startMinute: frame.startMinute },
    });
    await tx.planningEvent.updateMany({
      where: { planningId, endMinute: { gt: frame.endMinute } },
      data: { endMinute: frame.endMinute },
    });
  }
}
