import { createTestApp, type TestApp } from '../../setup/app.factory.js';
import { createVerifiedUser } from '../../setup/auth.helper.js';
import { cleanDatabase } from '../../setup/db.js';
import { UNKNOWN_ID } from '../../setup/test-id.js';
import {
  api,
  createPlanning,
  DEFAULT_CATEGORIES,
  FRAME,
} from './planning.helper.js';

type Event = {
  id: string;
  day: number;
  startMinute: number;
  endMinute: number;
  title: string;
  categoryId: string | null;
};

const event = (day: number, startMinute: number, endMinute: number) => ({
  day,
  startMinute,
  endMinute,
  title: `Event ${day} ${startMinute}`,
});

describe('Plannings (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
    await cleanDatabase(t.prisma);
  });

  afterAll(() => t.app.close());

  const newUser = async () => {
    const user = await createVerifiedUser(t);
    return { ...user, call: api(t, user.accessToken) };
  };

  // ─────────────────────────────────────────────────────────────
  // POST /plannings
  // ─────────────────────────────────────────────────────────────
  describe('POST /plannings', () => {
    it('201 creates the planning with its ordered categories (standard USER role)', async () => {
      const { call } = await newUser();

      const res = await call('post', '/plannings', {
        ...FRAME,
        name: '  Planning Lucas  ',
        categories: DEFAULT_CATEGORIES,
      }).expect(201);

      expect(res.body).toEqual({
        id: expect.any(String),
        name: 'Planning Lucas',
        firstDay: 1,
        dayCount: 5,
        startMinute: 480,
        endMinute: 1080,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        categories: DEFAULT_CATEGORIES.map((c, position) => ({
          id: expect.any(String),
          ...c,
          position,
        })),
        events: [],
      });
    });

    it('201 accepts the last palette hue (color 10)', async () => {
      const { call } = await newUser();

      const res = await call('post', '/plannings', {
        ...FRAME,
        categories: [{ name: 'Gris', color: 10 }],
      }).expect(201);

      expect(res.body.categories[0].color).toBe(10);
    });

    it('201 accepts an empty category list', async () => {
      const { call } = await newUser();

      const res = await call('post', '/plannings', {
        ...FRAME,
        categories: [],
      }).expect(201);

      expect(res.body.categories).toEqual([]);
    });

    it('201 creates initial events, mapping categoryIndex to the created categories', async () => {
      const { call } = await newUser();

      const res = await call('post', '/plannings', {
        ...FRAME,
        categories: [
          { name: 'École', color: 3 },
          { name: 'Sport', color: 1 },
        ],
        events: [
          { ...event(1, 510, 990), title: 'École', categoryIndex: 0 },
          { ...event(3, 945, 1020), title: 'Judo', categoryIndex: 1 },
          {
            ...event(5, 967, 1027),
            title: '  Goûter  ',
            categoryIndex: null,
            location: '   ',
            description: ' chez Mamie ',
          },
        ],
      }).expect(201);

      const [ecole, sport] = res.body.categories;
      expect(res.body.events).toEqual([
        expect.objectContaining({
          day: 1,
          startMinute: 510,
          endMinute: 990,
          title: 'École',
          categoryId: ecole.id,
        }),
        expect.objectContaining({ title: 'Judo', categoryId: sport.id }),
        expect.objectContaining({
          day: 5,
          startMinute: 967,
          endMinute: 1027,
          title: 'Goûter',
          categoryId: null,
          location: null,
          description: 'chez Mamie',
        }),
      ]);
    });

    it('201 accepts days wrapping past Sunday (Friday to Monday)', async () => {
      const { call } = await newUser();

      const res = await call('post', '/plannings', {
        ...FRAME,
        firstDay: 5,
        dayCount: 4,
        categories: [],
        events: [event(7, 600, 660), event(1, 600, 660)],
      }).expect(201);

      expect(res.body.events.map((e: Event) => e.day)).toEqual([1, 7]);
    });

    it.each([
      [
        'end not after start',
        event(1, 600, 600),
        'planning.event.invalid_time_range',
      ],
      [
        'day outside the planning',
        event(6, 600, 660),
        'planning.event.outside_days',
      ],
      [
        'outside the range',
        event(1, 1020, 1100),
        'planning.event.out_of_range',
      ],
      [
        'unknown categoryIndex',
        { ...event(1, 600, 660), categoryIndex: 5 },
        'planning.category.not_in_planning',
      ],
    ])(
      '400 for an initial event with %s, with its index, and nothing is created',
      async (_label, invalid, code) => {
        const { call } = await newUser();

        const res = await call('post', '/plannings', {
          ...FRAME,
          events: [event(1, 600, 660), invalid],
          categories: DEFAULT_CATEGORIES,
        }).expect(400);

        expect(res.body).toMatchObject({ code, params: { index: 1 } });
        const list = await call('get', '/plannings').expect(200);
        expect(list.body.meta.total).toBe(0);
      },
    );

    it('400 planning.invalid_time_range when the range end is not after its start', async () => {
      const { call } = await newUser();

      const res = await call('post', '/plannings', {
        ...FRAME,
        startMinute: 600,
        endMinute: 600,
        categories: [],
      }).expect(400);

      expect(res.body.code).toBe('planning.invalid_time_range');
    });

    it.each([
      ['a blank name', { name: '   ' }, 'name', 'validation.name.isNotEmpty'],
      [
        'a too long name',
        { name: 'x'.repeat(101) },
        'name',
        'validation.name.maxLength',
      ],
      ['firstDay 0', { firstDay: 0 }, 'firstDay', 'validation.firstDay.min'],
      ['dayCount 8', { dayCount: 8 }, 'dayCount', 'validation.dayCount.max'],
      [
        'endMinute 1441',
        { endMinute: 1441 },
        'endMinute',
        'validation.endMinute.max',
      ],
      [
        'a non-integer minute',
        { startMinute: 480.5 },
        'startMinute',
        'validation.startMinute.isInt',
      ],
      [
        'a category color 0',
        { categories: [{ name: 'Rouge', color: 0 }] },
        'categories.0.color',
        'validation.color.min',
      ],
      [
        'a category color 11',
        { categories: [{ name: 'Rouge', color: 11 }] },
        'categories.0.color',
        'validation.color.max',
      ],
      [
        'a blank category name',
        { categories: [{ name: '  ', color: 1 }] },
        'categories.0.name',
        'validation.name.isNotEmpty',
      ],
      [
        '21 categories',
        {
          categories: Array.from({ length: 21 }, () => ({
            name: 'C',
            color: 1,
          })),
        },
        'categories',
        'validation.categories.arrayMaxSize',
      ],
      [
        'a blank event title',
        { events: [{ ...event(1, 600, 660), title: ' ' }] },
        'events.0.title',
        'validation.title.isNotEmpty',
      ],
    ])('400 validation.failed for %s', async (_label, override, key, code) => {
      const { call } = await newUser();

      const res = await call('post', '/plannings', {
        ...FRAME,
        categories: [],
        ...override,
      }).expect(400);

      expect(res.body.code).toBe('validation.failed');
      expect(res.body.params.fields).toContainEqual({ key, code });
    });

    it('409 planning.limit.plannings beyond 50 plannings', async () => {
      const { call, userId } = await newUser();
      await t.prisma.planning.createMany({
        data: Array.from({ length: 50 }, () => ({ ...FRAME, ownerId: userId })),
      });

      const res = await call('post', '/plannings', {
        ...FRAME,
        categories: [],
      }).expect(409);

      expect(res.body).toMatchObject({
        code: 'planning.limit.plannings',
        params: { max: 50 },
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /plannings
  // ─────────────────────────────────────────────────────────────
  describe('GET /plannings', () => {
    it('200 lists only my plannings, newest first, without categories and events', async () => {
      const me = await newUser();
      const other = await newUser();
      await createPlanning(t, me.accessToken, { name: 'First' });
      await createPlanning(t, me.accessToken, { name: 'Second' });
      await createPlanning(t, other.accessToken, { name: 'Not mine' });

      const res = await me.call('get', '/plannings').expect(200);

      expect(res.body.data.map((p: { name: string }) => p.name)).toEqual([
        'Second',
        'First',
      ]);
      expect(Object.keys(res.body.data[0]).sort()).toEqual(
        [
          'createdAt',
          'dayCount',
          'endMinute',
          'firstDay',
          'id',
          'name',
          'startMinute',
          'updatedAt',
        ].sort(),
      );
      expect(res.body.meta).toEqual({
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
    });

    it('200 returns up to 50 plannings in one page with limit=50', async () => {
      const { call, userId } = await newUser();
      await t.prisma.planning.createMany({
        data: Array.from({ length: 50 }, () => ({ ...FRAME, ownerId: userId })),
      });

      const res = await call('get', '/plannings?limit=50').expect(200);

      expect(res.body.data).toHaveLength(50);
      expect(res.body.meta.totalPages).toBe(1);
    });

    it('200 sorts by name', async () => {
      const me = await newUser();
      await createPlanning(t, me.accessToken, { name: 'B' });
      await createPlanning(t, me.accessToken, { name: 'A' });

      const res = await me
        .call('get', '/plannings?sortBy=name&sortOrder=asc')
        .expect(200);

      expect(res.body.data.map((p: { name: string }) => p.name)).toEqual([
        'A',
        'B',
      ]);
    });

    it('400 validation.failed for an unknown sortBy', async () => {
      const { call } = await newUser();

      const res = await call('get', '/plannings?sortBy=ownerId').expect(400);

      expect(res.body.code).toBe('validation.failed');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /plannings/:id
  // ─────────────────────────────────────────────────────────────
  describe('GET /plannings/:id', () => {
    it('200 returns the planning with its categories and its events sorted by day then start', async () => {
      const me = await newUser();
      const planning = await createPlanning(t, me.accessToken, {
        events: [event(2, 600, 660), event(1, 900, 960), event(1, 480, 540)],
      });

      const res = await me.call('get', `/plannings/${planning.id}`).expect(200);

      expect(res.body.categories).toHaveLength(5);
      expect(res.body.events.map((e: Event) => [e.day, e.startMinute])).toEqual(
        [
          [1, 480],
          [1, 900],
          [2, 600],
        ],
      );
      expect(res.body.events[0]).not.toHaveProperty('planningId');
      expect(res.body).not.toHaveProperty('ownerId');
    });

    it("404 planning.not_found for another user's planning", async () => {
      const owner = await newUser();
      const intruder = await newUser();
      const planning = await createPlanning(t, owner.accessToken);

      const res = await intruder
        .call('get', `/plannings/${planning.id}`)
        .expect(404);

      expect(res.body.code).toBe('planning.not_found');
    });

    it('404 planning.not_found for an unknown id', async () => {
      const { call } = await newUser();

      const res = await call('get', `/plannings/${UNKNOWN_ID}`).expect(404);

      expect(res.body.code).toBe('planning.not_found');
    });

    it('400 for an id that is not a UUID v7', async () => {
      const { call } = await newUser();

      await call('get', '/plannings/abc').expect(400);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // PUT /plannings/:id
  // ─────────────────────────────────────────────────────────────
  describe('PUT /plannings/:id', () => {
    const categoriesOf = async (planningId: string) =>
      t.prisma.planningCategory.findMany({
        where: { planningId },
        orderBy: { position: 'asc' },
      });

    it('200 updates, creates, reorders and deletes categories; events of a deleted category become "Non défini"', async () => {
      const me = await newUser();
      const planning = await createPlanning(t, me.accessToken, {
        categories: [
          { name: 'Bleu', color: 3 },
          { name: 'Vert', color: 1 },
          { name: 'Musique', color: 4 },
        ],
        events: [
          { ...event(1, 600, 660), categoryIndex: 0 },
          { ...event(2, 600, 660), categoryIndex: 2 },
        ],
      });
      const [bleu, vert, musique] = planning.categories;

      const res = await me
        .call('put', `/plannings/${planning.id}`, {
          ...FRAME,
          categories: [
            { id: vert.id, name: 'Sport', color: 5 },
            { id: bleu.id, name: 'École', color: 3 },
            { name: 'Danse', color: 2 },
          ],
        })
        .expect(200);

      expect(res.body.categories).toEqual([
        { id: vert.id, name: 'Sport', color: 5, position: 0 },
        { id: bleu.id, name: 'École', color: 3, position: 1 },
        { id: expect.any(String), name: 'Danse', color: 2, position: 2 },
      ]);
      expect(res.body.events).toEqual([
        expect.objectContaining({ day: 1, categoryId: bleu.id }),
        expect.objectContaining({ day: 2, categoryId: null }),
      ]);
      expect(
        await t.prisma.planningCategory.findUnique({
          where: { id: musique.id },
        }),
      ).toBeNull();
    });

    it('200 accepts color 10 on an existing category', async () => {
      const me = await newUser();
      const planning = await createPlanning(t, me.accessToken);
      const [first] = planning.categories;

      const res = await me
        .call('put', `/plannings/${planning.id}`, {
          ...FRAME,
          categories: [{ id: first.id, name: first.name, color: 10 }],
        })
        .expect(200);

      expect(res.body.categories).toEqual([
        { id: first.id, name: first.name, color: 10, position: 0 },
      ]);
    });

    it('400 validation.failed for color 11, and nothing changes', async () => {
      const me = await newUser();
      const planning = await createPlanning(t, me.accessToken);
      const [first] = planning.categories;

      const res = await me
        .call('put', `/plannings/${planning.id}`, {
          ...FRAME,
          categories: [{ id: first.id, name: first.name, color: 11 }],
        })
        .expect(400);

      expect(res.body.code).toBe('validation.failed');
      expect(res.body.params.fields).toContainEqual({
        key: 'categories.0.color',
        code: 'validation.color.max',
      });
      expect(await categoriesOf(planning.id)).toHaveLength(5);
    });

    it('400 planning.category.not_in_planning for a category id of another planning, and nothing changes', async () => {
      const me = await newUser();
      const planning = await createPlanning(t, me.accessToken);
      const other = await createPlanning(t, me.accessToken);

      const res = await me
        .call('put', `/plannings/${planning.id}`, {
          ...FRAME,
          name: 'Renamed',
          categories: [
            { name: 'New', color: 1 },
            { id: other.categories[0].id, name: 'Stolen', color: 1 },
          ],
        })
        .expect(400);

      expect(res.body).toMatchObject({
        code: 'planning.category.not_in_planning',
        params: { index: 1 },
      });
      const unchanged = await me
        .call('get', `/plannings/${planning.id}`)
        .expect(200);
      expect(unchanged.body.name).toBe('Planning Lucas');
      expect(await categoriesOf(planning.id)).toHaveLength(5);
    });

    it('200 deletes the events of removed days only', async () => {
      const me = await newUser();
      const planning = await createPlanning(t, me.accessToken, {
        events: [event(1, 600, 660), event(4, 600, 660), event(5, 600, 660)],
      });

      const res = await me
        .call('put', `/plannings/${planning.id}`, {
          ...FRAME,
          dayCount: 4,
          categories: DEFAULT_CATEGORIES,
        })
        .expect(200);

      expect(res.body.dayCount).toBe(4);
      expect(res.body.events.map((e: Event) => e.day)).toEqual([1, 4]);
    });

    it('200 handles removed days on a sequence wrapping past Sunday', async () => {
      const me = await newUser();
      // Friday to Monday
      const planning = await createPlanning(t, me.accessToken, {
        firstDay: 5,
        dayCount: 4,
        events: [event(5, 600, 660), event(7, 600, 660), event(1, 600, 660)],
      });

      // Saturday to Tuesday: Friday is removed
      const res = await me
        .call('put', `/plannings/${planning.id}`, {
          ...FRAME,
          firstDay: 6,
          dayCount: 4,
          categories: DEFAULT_CATEGORIES,
        })
        .expect(200);

      expect(res.body.events.map((e: Event) => e.day)).toEqual([1, 7]);
    });

    it('200 clips events partly outside a reduced range and deletes those fully outside', async () => {
      const me = await newUser();
      const planning = await createPlanning(t, me.accessToken, {
        events: [
          event(1, 960, 1050), // 16:00 - 17:30 → 16:00 - 17:00
          event(1, 1035, 1080), // 17:15 - 18:00 → deleted
          event(2, 480, 600), // 8:00 - 10:00 → 9:00 - 10:00
          event(2, 480, 540), // 8:00 - 9:00 → deleted (ends on the new start)
          event(3, 500, 1070), // covers both bounds → 9:00 - 17:00
          event(4, 997, 1018), // inside, minute-precise → kept as is
        ],
      });

      const res = await me
        .call('put', `/plannings/${planning.id}`, {
          ...FRAME,
          startMinute: 540,
          endMinute: 1020,
          categories: DEFAULT_CATEGORIES,
        })
        .expect(200);

      expect(
        res.body.events.map((e: Event) => [e.day, e.startMinute, e.endMinute]),
      ).toEqual([
        [1, 960, 1020],
        [2, 540, 600],
        [3, 540, 1020],
        [4, 997, 1018],
      ]);
    });

    it('200 leaves events untouched when the range is widened', async () => {
      const me = await newUser();
      const planning = await createPlanning(t, me.accessToken, {
        events: [event(1, 480, 1080)],
      });

      const res = await me
        .call('put', `/plannings/${planning.id}`, {
          ...FRAME,
          startMinute: 420,
          endMinute: 1140,
          categories: DEFAULT_CATEGORIES,
        })
        .expect(200);

      expect(res.body.events).toEqual([
        expect.objectContaining({ startMinute: 480, endMinute: 1080 }),
      ]);
    });

    it('400 planning.invalid_time_range when the range end is not after its start', async () => {
      const me = await newUser();
      const planning = await createPlanning(t, me.accessToken);

      const res = await me
        .call('put', `/plannings/${planning.id}`, {
          ...FRAME,
          startMinute: 900,
          endMinute: 600,
          categories: [],
        })
        .expect(400);

      expect(res.body.code).toBe('planning.invalid_time_range');
    });

    it("404 planning.not_found for another user's planning, which is left untouched", async () => {
      const owner = await newUser();
      const intruder = await newUser();
      const planning = await createPlanning(t, owner.accessToken, {
        events: [event(5, 600, 660)],
      });

      const res = await intruder
        .call('put', `/plannings/${planning.id}`, {
          ...FRAME,
          dayCount: 1,
          categories: [],
        })
        .expect(404);

      expect(res.body.code).toBe('planning.not_found');
      const unchanged = await owner
        .call('get', `/plannings/${planning.id}`)
        .expect(200);
      expect(unchanged.body.events).toHaveLength(1);
      expect(unchanged.body.categories).toHaveLength(5);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // DELETE /plannings/:id
  // ─────────────────────────────────────────────────────────────
  describe('DELETE /plannings/:id', () => {
    it('200 deletes the planning with its categories and events', async () => {
      const me = await newUser();
      const planning = await createPlanning(t, me.accessToken, {
        events: [event(1, 600, 660)],
      });

      const res = await me
        .call('delete', `/plannings/${planning.id}`)
        .expect(200);

      expect(res.body).toEqual({
        message: 'Planning deleted',
        code: 'planning.deleted',
      });
      expect(
        await t.prisma.planningCategory.count({
          where: { planningId: planning.id },
        }),
      ).toBe(0);
      expect(
        await t.prisma.planningEvent.count({
          where: { planningId: planning.id },
        }),
      ).toBe(0);
      await me.call('delete', `/plannings/${planning.id}`).expect(404);
    });

    it("404 planning.not_found for another user's planning, which still exists", async () => {
      const owner = await newUser();
      const intruder = await newUser();
      const planning = await createPlanning(t, owner.accessToken);

      const res = await intruder
        .call('delete', `/plannings/${planning.id}`)
        .expect(404);

      expect(res.body.code).toBe('planning.not_found');
      await owner.call('get', `/plannings/${planning.id}`).expect(200);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Account deletion
  // ─────────────────────────────────────────────────────────────
  describe('account deletion', () => {
    it('deleting my account deletes my plannings, not the others', async () => {
      const me = await newUser();
      const other = await newUser();
      await createPlanning(t, me.accessToken, { events: [event(1, 600, 660)] });
      await createPlanning(t, other.accessToken);

      await me.call('delete', '/profiles/me').expect(200);

      expect(
        await t.prisma.planning.count({ where: { ownerId: me.userId } }),
      ).toBe(0);
      expect(
        await t.prisma.planning.count({ where: { ownerId: other.userId } }),
      ).toBe(1);
    });
  });
});
