import type { Prisma } from '../../../generated/prisma/client.js';

// Response shapes: ownerId and planningId are never exposed
export const planningSummarySelect = {
  id: true,
  name: true,
  firstDay: true,
  dayCount: true,
  startMinute: true,
  endMinute: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PlanningSelect;

export const planningEventSelect = {
  id: true,
  day: true,
  startMinute: true,
  endMinute: true,
  title: true,
  categoryId: true,
  location: true,
  description: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PlanningEventSelect;

export const planningDetailSelect = {
  ...planningSummarySelect,
  categories: {
    select: { id: true, name: true, color: true, position: true },
    orderBy: { position: 'asc' },
  },
  events: {
    select: planningEventSelect,
    orderBy: [{ day: 'asc' }, { startMinute: 'asc' }],
  },
} satisfies Prisma.PlanningSelect;
