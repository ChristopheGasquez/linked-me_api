import { PlanningResponseCodes as Codes } from './planning.response-codes.js';

export type PlanningFrame = {
  firstDay: number;
  dayCount: number;
  startMinute: number;
  endMinute: number;
};

export type EventSlot = { day: number; startMinute: number; endMinute: number };

// ISO days of the planning in display order; the sequence may wrap past Sunday
export const planningDays = ({
  firstDay,
  dayCount,
}: Pick<PlanningFrame, 'firstDay' | 'dayCount'>): number[] =>
  Array.from({ length: dayCount }, (_, i) => ((firstDay - 1 + i) % 7) + 1);

export const isDayInPlanning = (
  day: number,
  { firstDay, dayCount }: Pick<PlanningFrame, 'firstDay' | 'dayCount'>,
): boolean => (day - firstDay + 7) % 7 < dayCount;

// Code of the first broken rule, null when the slot fits the planning
export function eventSlotError(
  slot: EventSlot,
  frame: PlanningFrame,
): string | null {
  if (slot.endMinute <= slot.startMinute) {
    return Codes.PLANNING_EVENT_INVALID_TIME_RANGE;
  }
  if (!isDayInPlanning(slot.day, frame)) {
    return Codes.PLANNING_EVENT_OUTSIDE_DAYS;
  }
  if (
    slot.startMinute < frame.startMinute ||
    slot.endMinute > frame.endMinute
  ) {
    return Codes.PLANNING_EVENT_OUT_OF_RANGE;
  }
  return null;
}
