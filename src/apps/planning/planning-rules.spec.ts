import {
  eventSlotError,
  isDayInPlanning,
  planningDays,
  type PlanningFrame,
} from './planning-rules.js';

// Monday to Friday, 8:00 - 18:00
const weekdays: PlanningFrame = {
  firstDay: 1,
  dayCount: 5,
  startMinute: 480,
  endMinute: 1080,
};

describe('planning rules', () => {
  describe('planningDays', () => {
    it('should list consecutive days within the week', () => {
      expect(planningDays({ firstDay: 1, dayCount: 5 })).toEqual([
        1, 2, 3, 4, 5,
      ]);
    });

    it('should wrap past Sunday', () => {
      expect(planningDays({ firstDay: 5, dayCount: 4 })).toEqual([5, 6, 7, 1]);
    });

    it('should list the 7 days starting from any day', () => {
      expect(planningDays({ firstDay: 3, dayCount: 7 })).toEqual([
        3, 4, 5, 6, 7, 1, 2,
      ]);
    });

    it('should handle a single day', () => {
      expect(planningDays({ firstDay: 7, dayCount: 1 })).toEqual([7]);
    });
  });

  describe('isDayInPlanning', () => {
    const fridayToMonday = { firstDay: 5, dayCount: 4 };

    it.each([5, 6, 7, 1])(
      'should accept day %i of a sequence wrapping past Sunday',
      (day) => {
        expect(isDayInPlanning(day, fridayToMonday)).toBe(true);
      },
    );

    it.each([2, 3, 4])(
      'should reject day %i outside a sequence wrapping past Sunday',
      (day) => {
        expect(isDayInPlanning(day, fridayToMonday)).toBe(false);
      },
    );

    it('should include both ends of a sequence within the week', () => {
      expect(isDayInPlanning(1, weekdays)).toBe(true);
      expect(isDayInPlanning(5, weekdays)).toBe(true);
      expect(isDayInPlanning(6, weekdays)).toBe(false);
      expect(isDayInPlanning(7, weekdays)).toBe(false);
    });
  });

  describe('eventSlotError', () => {
    it('should reject an end equal to the start', () => {
      expect(
        eventSlotError({ day: 1, startMinute: 600, endMinute: 600 }, weekdays),
      ).toBe('planning.event.invalid_time_range');
    });

    it('should reject an end before the start', () => {
      expect(
        eventSlotError({ day: 1, startMinute: 540, endMinute: 480 }, weekdays),
      ).toBe('planning.event.invalid_time_range');
    });

    it('should reject a day outside the planning', () => {
      expect(
        eventSlotError({ day: 6, startMinute: 600, endMinute: 660 }, weekdays),
      ).toBe('planning.event.outside_days');
    });

    it('should reject an event starting before the range', () => {
      expect(
        eventSlotError({ day: 1, startMinute: 479, endMinute: 540 }, weekdays),
      ).toBe('planning.event.out_of_range');
    });

    it('should reject an event ending after the range', () => {
      expect(
        eventSlotError(
          { day: 1, startMinute: 1020, endMinute: 1081 },
          weekdays,
        ),
      ).toBe('planning.event.out_of_range');
    });

    it('should accept an event exactly on the range bounds', () => {
      expect(
        eventSlotError({ day: 5, startMinute: 480, endMinute: 1080 }, weekdays),
      ).toBeNull();
    });

    it('should accept minute-precise times', () => {
      expect(
        eventSlotError({ day: 3, startMinute: 967, endMinute: 1078 }, weekdays),
      ).toBeNull();
    });

    it('should report the time range first, then the day, then the range', () => {
      expect(
        eventSlotError(
          { day: 6, startMinute: 1200, endMinute: 1100 },
          weekdays,
        ),
      ).toBe('planning.event.invalid_time_range');
      expect(
        eventSlotError(
          { day: 6, startMinute: 1100, endMinute: 1200 },
          weekdays,
        ),
      ).toBe('planning.event.outside_days');
    });
  });
});
