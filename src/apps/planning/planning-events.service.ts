import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { PlanningConstants as C } from './planning.constants.js';
import { PlanningResponseCodes as Codes } from './planning.response-codes.js';
import { eventSlotError } from './planning-rules.js';
import {
  eventNotFound,
  planningBadRequest,
  planningConflict,
  planningNotFound,
} from './planning-errors.js';
import { planningEventSelect } from './planning.selects.js';
import type {
  CreatePlanningEventDto,
  UpdatePlanningEventDto,
} from './dto/planning-event.dto.js';

@Injectable()
export class PlanningEventsService {
  constructor(private prisma: PrismaService) {}

  async create(
    ownerId: string,
    planningId: string,
    dto: CreatePlanningEventDto,
  ) {
    const planning = await this.findOwnedPlanning(ownerId, planningId);
    await this.assertCategoryInPlanning(planningId, dto.categoryId);
    const error = eventSlotError(dto, planning);
    if (error) throw planningBadRequest(error);

    const count = await this.prisma.planningEvent.count({
      where: { planningId },
    });
    if (count >= C.MAX_EVENTS_PER_PLANNING) {
      throw planningConflict(Codes.PLANNING_LIMIT_EVENTS, {
        max: C.MAX_EVENTS_PER_PLANNING,
      });
    }

    return this.prisma.planningEvent.create({
      data: {
        planningId,
        day: dto.day,
        startMinute: dto.startMinute,
        endMinute: dto.endMinute,
        title: dto.title,
        categoryId: dto.categoryId ?? null,
        location: dto.location ?? null,
        description: dto.description ?? null,
      },
      select: planningEventSelect,
    });
  }

  async update(
    ownerId: string,
    planningId: string,
    eventId: string,
    dto: UpdatePlanningEventDto,
  ) {
    const planning = await this.findOwnedPlanning(ownerId, planningId);
    const event = await this.prisma.planningEvent.findFirst({
      where: { id: eventId, planningId },
      select: { day: true, startMinute: true, endMinute: true },
    });
    if (!event) throw eventNotFound();

    await this.assertCategoryInPlanning(planningId, dto.categoryId);
    const error = eventSlotError(
      {
        day: dto.day ?? event.day,
        startMinute: dto.startMinute ?? event.startMinute,
        endMinute: dto.endMinute ?? event.endMinute,
      },
      planning,
    );
    if (error) throw planningBadRequest(error);

    return this.prisma.planningEvent.update({
      where: { id: eventId },
      data: dto,
      select: planningEventSelect,
    });
  }

  async remove(ownerId: string, planningId: string, eventId: string) {
    await this.findOwnedPlanning(ownerId, planningId);
    const { count } = await this.prisma.planningEvent.deleteMany({
      where: { id: eventId, planningId },
    });
    if (count === 0) throw eventNotFound();
    return { message: 'Event deleted', code: Codes.PLANNING_EVENT_DELETED };
  }

  async clear(ownerId: string, planningId: string) {
    await this.findOwnedPlanning(ownerId, planningId);
    const { count } = await this.prisma.planningEvent.deleteMany({
      where: { planningId },
    });
    return {
      message: 'Planning cleared',
      code: Codes.PLANNING_CLEARED,
      params: { count },
    };
  }

  private async findOwnedPlanning(ownerId: string, planningId: string) {
    const planning = await this.prisma.planning.findFirst({
      where: { id: planningId, ownerId },
      select: {
        firstDay: true,
        dayCount: true,
        startMinute: true,
        endMinute: true,
      },
    });
    if (!planning) throw planningNotFound();
    return planning;
  }

  private async assertCategoryInPlanning(
    planningId: string,
    categoryId: string | null | undefined,
  ) {
    if (!categoryId) return;
    const category = await this.prisma.planningCategory.findFirst({
      where: { id: categoryId, planningId },
      select: { id: true },
    });
    if (!category) {
      throw planningBadRequest(Codes.PLANNING_CATEGORY_NOT_IN_PLANNING);
    }
  }
}
