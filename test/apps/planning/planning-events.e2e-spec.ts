import { createTestApp, type TestApp } from '../../setup/app.factory.js';
import { createVerifiedUser } from '../../setup/auth.helper.js';
import { cleanDatabase } from '../../setup/db.js';
import { UNKNOWN_ID } from '../../setup/test-id.js';
import { api, createPlanning } from './planning.helper.js';

// planning: Monday to Friday, 8:00 - 18:00
const EVENT = {
  day: 5,
  startMinute: 967, // 16:07
  endMinute: 1027, // 17:07
  title: 'Goûter chez Mamie',
};

describe('Planning events (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
    await cleanDatabase(t.prisma);
  });

  afterAll(() => t.app.close());

  /** A user with one planning (default categories) */
  const setup = async (planningBody: object = {}) => {
    const user = await createVerifiedUser(t);
    const planning = await createPlanning(t, user.accessToken, planningBody);
    const call = api(t, user.accessToken);
    const events = `/plannings/${planning.id}/events`;
    return { user, planning, call, events };
  };

  // ─────────────────────────────────────────────────────────────
  // POST /plannings/:id/events
  // ─────────────────────────────────────────────────────────────
  describe('POST /plannings/:id/events', () => {
    it('201 creates a minute-precise event without category ("Non défini")', async () => {
      const { call, events } = await setup();

      const res = await call('post', events, EVENT).expect(201);

      expect(res.body).toEqual({
        id: expect.any(String),
        ...EVENT,
        categoryId: null,
        location: null,
        description: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('201 creates an event with a category of the planning, location and description', async () => {
      const { call, events, planning } = await setup();

      const res = await call('post', events, {
        ...EVENT,
        categoryId: planning.categories[1].id,
        location: '  Gymnase ',
        description: 'Prévoir le kimono',
      }).expect(201);

      expect(res.body).toMatchObject({
        categoryId: planning.categories[1].id,
        location: 'Gymnase',
        description: 'Prévoir le kimono',
      });
    });

    it('201 allows overlapping events', async () => {
      const { call, events } = await setup();

      await call('post', events, EVENT).expect(201);
      await call('post', events, { ...EVENT, title: 'Judo' }).expect(201);
    });

    it('201 accepts a day of a sequence wrapping past Sunday', async () => {
      const { call, events } = await setup({ firstDay: 6, dayCount: 3 });

      await call('post', events, { ...EVENT, day: 1 }).expect(201);
    });

    it.each([
      [
        'end equal to start',
        { endMinute: 967 },
        'planning.event.invalid_time_range',
      ],
      [
        'end before start',
        { endMinute: 480 },
        'planning.event.invalid_time_range',
      ],
      ['day outside the planning', { day: 6 }, 'planning.event.outside_days'],
      [
        'start before the range',
        { startMinute: 470 },
        'planning.event.out_of_range',
      ],
      [
        'end after the range',
        { endMinute: 1110 },
        'planning.event.out_of_range',
      ],
    ])('400 for %s', async (_label, override, code) => {
      const { call, events } = await setup();

      const res = await call('post', events, { ...EVENT, ...override }).expect(
        400,
      );

      expect(res.body.code).toBe(code);
    });

    it('400 planning.category.not_in_planning for a category of another planning', async () => {
      const { call, events, user } = await setup();
      const other = await createPlanning(t, user.accessToken);

      const res = await call('post', events, {
        ...EVENT,
        categoryId: other.categories[0].id,
      }).expect(400);

      expect(res.body.code).toBe('planning.category.not_in_planning');
    });

    it.each([
      [
        'a blank title',
        { title: '   ' },
        'title',
        'validation.title.isNotEmpty',
      ],
      [
        'a too long title',
        { title: 'x'.repeat(101) },
        'title',
        'validation.title.maxLength',
      ],
      ['day 8', { day: 8 }, 'day', 'validation.day.max'],
      [
        'endMinute 1441',
        { endMinute: 1441 },
        'endMinute',
        'validation.endMinute.max',
      ],
      [
        'a too long description',
        { description: 'x'.repeat(2001) },
        'description',
        'validation.description.maxLength',
      ],
      [
        'an invalid categoryId',
        { categoryId: 'abc' },
        'categoryId',
        'validation.categoryId.isUuid',
      ],
    ])('400 validation.failed for %s', async (_label, override, key, code) => {
      const { call, events } = await setup();

      const res = await call('post', events, { ...EVENT, ...override }).expect(
        400,
      );

      expect(res.body.code).toBe('validation.failed');
      expect(res.body.params.fields).toContainEqual({ key, code });
    });

    it("404 planning.not_found on another user's planning", async () => {
      const { events } = await setup();
      const intruder = await createVerifiedUser(t);

      const res = await api(t, intruder.accessToken)(
        'post',
        events,
        EVENT,
      ).expect(404);

      expect(res.body.code).toBe('planning.not_found');
    });

    it('409 planning.limit.events beyond 500 events', async () => {
      const { call, events, planning } = await setup();
      await t.prisma.planningEvent.createMany({
        data: Array.from({ length: 500 }, () => ({
          ...EVENT,
          planningId: planning.id,
        })),
      });

      const res = await call('post', events, EVENT).expect(409);

      expect(res.body).toMatchObject({
        code: 'planning.limit.events',
        params: { max: 500 },
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // PATCH /plannings/:id/events/:eventId
  // ─────────────────────────────────────────────────────────────
  describe('PATCH /plannings/:id/events/:eventId', () => {
    const withEvent = async () => {
      const ctx = await setup();
      const created = await ctx.call('post', ctx.events, {
        ...EVENT,
        categoryId: ctx.planning.categories[0].id,
        location: 'Chez Mamie',
      });
      return { ...ctx, event: `${ctx.events}/${created.body.id}` };
    };

    it('200 moves the event (day and times), keeping its other properties', async () => {
      const { call, event, planning } = await withEvent();

      const res = await call('patch', event, {
        day: 4,
        startMinute: 982,
        endMinute: 1042,
      }).expect(200);

      expect(res.body).toMatchObject({
        day: 4,
        startMinute: 982,
        endMinute: 1042,
        title: EVENT.title,
        categoryId: planning.categories[0].id,
        location: 'Chez Mamie',
      });
    });

    it('200 updates the end alone, to the minute', async () => {
      const { call, event } = await withEvent();

      const res = await call('patch', event, { endMinute: 1078 }).expect(200);

      expect(res.body).toMatchObject({ startMinute: 967, endMinute: 1078 });
    });

    it('200 clears the category, location and description with null', async () => {
      const { call, event } = await withEvent();

      const res = await call('patch', event, {
        categoryId: null,
        location: null,
        description: '',
      }).expect(200);

      expect(res.body).toMatchObject({
        categoryId: null,
        location: null,
        description: null,
      });
    });

    it('400 planning.event.invalid_time_range when the new start is after the current end', async () => {
      const { call, event } = await withEvent();

      const res = await call('patch', event, { startMinute: 1050 }).expect(400);

      expect(res.body.code).toBe('planning.event.invalid_time_range');
    });

    it('400 planning.event.out_of_range when moved past the range end', async () => {
      const { call, event } = await withEvent();

      const res = await call('patch', event, { endMinute: 1110 }).expect(400);

      expect(res.body.code).toBe('planning.event.out_of_range');
    });

    it('400 planning.event.outside_days when moved to a day outside the planning', async () => {
      const { call, event } = await withEvent();

      const res = await call('patch', event, { day: 7 }).expect(400);

      expect(res.body.code).toBe('planning.event.outside_days');
    });

    it('400 planning.category.not_in_planning for a category of another planning', async () => {
      const { call, event, user } = await withEvent();
      const other = await createPlanning(t, user.accessToken);

      const res = await call('patch', event, {
        categoryId: other.categories[0].id,
      }).expect(400);

      expect(res.body.code).toBe('planning.category.not_in_planning');
    });

    it('400 validation.failed when a required field is set to null', async () => {
      const { call, event } = await withEvent();

      const res = await call('patch', event, { title: null }).expect(400);

      expect(res.body.code).toBe('validation.failed');
      expect(res.body.params.fields[0].key).toBe('title');
    });

    it('404 planning.event.not_found for an event of another planning', async () => {
      const { call, event, user } = await withEvent();
      const other = await createPlanning(t, user.accessToken);
      const eventId = event.split('/').pop();

      const res = await call(
        'patch',
        `/plannings/${other.id}/events/${eventId}`,
        { title: 'Moved' },
      ).expect(404);

      expect(res.body.code).toBe('planning.event.not_found');
    });

    it("404 planning.not_found on another user's planning", async () => {
      const { event } = await withEvent();
      const intruder = await createVerifiedUser(t);

      const res = await api(t, intruder.accessToken)('patch', event, {
        title: 'Hacked',
      }).expect(404);

      expect(res.body.code).toBe('planning.not_found');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // DELETE /plannings/:id/events/:eventId
  // ─────────────────────────────────────────────────────────────
  describe('DELETE /plannings/:id/events/:eventId', () => {
    it('200 deletes the event, then 404 planning.event.not_found', async () => {
      const { call, events } = await setup();
      const created = await call('post', events, EVENT).expect(201);
      const event = `${events}/${created.body.id}`;

      const res = await call('delete', event).expect(200);

      expect(res.body).toEqual({
        message: 'Event deleted',
        code: 'planning.event.deleted',
      });
      const again = await call('delete', event).expect(404);
      expect(again.body.code).toBe('planning.event.not_found');
    });

    it("404 planning.not_found on another user's planning, and the event still exists", async () => {
      const { call, events, planning } = await setup();
      const created = await call('post', events, EVENT).expect(201);
      const intruder = await createVerifiedUser(t);

      await api(t, intruder.accessToken)(
        'delete',
        `${events}/${created.body.id}`,
      ).expect(404);

      const res = await call('get', `/plannings/${planning.id}`).expect(200);
      expect(res.body.events).toHaveLength(1);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // DELETE /plannings/:id/events (clear)
  // ─────────────────────────────────────────────────────────────
  describe('DELETE /plannings/:id/events', () => {
    it('200 deletes every event and keeps the planning structure', async () => {
      const { call, events, planning } = await setup({
        events: [
          { ...EVENT, categoryIndex: 0 },
          { ...EVENT, day: 1 },
        ],
      });

      const res = await call('delete', events).expect(200);

      expect(res.body).toEqual({
        message: 'Planning cleared',
        code: 'planning.cleared',
        params: { count: 2 },
      });
      const after = await call('get', `/plannings/${planning.id}`).expect(200);
      expect(after.body).toMatchObject({
        name: 'Planning Lucas',
        firstDay: 1,
        dayCount: 5,
        events: [],
      });
      expect(after.body.categories).toHaveLength(5);
    });

    it("404 planning.not_found on another user's planning", async () => {
      const { events } = await setup();
      const intruder = await createVerifiedUser(t);

      const res = await api(t, intruder.accessToken)('delete', events).expect(
        404,
      );

      expect(res.body.code).toBe('planning.not_found');
    });

    it('404 planning.not_found for an unknown planning', async () => {
      const { call } = await setup();

      await call('delete', `/plannings/${UNKNOWN_ID}/events`).expect(404);
    });
  });
});
