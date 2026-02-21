import { paginate } from './paginate.js';

const makeModel = (items: unknown[], total: number) => ({
  findMany: jest.fn().mockResolvedValue(items),
  count: jest.fn().mockResolvedValue(total),
});

const baseQuery = {
  page: 1,
  limit: 20,
  sortBy: 'createdAt',
  sortOrder: 'desc' as const,
};

describe('paginate()', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // Basic pagination
  // ─────────────────────────────────────────────────────────────
  describe('basic pagination', () => {
    it('should return data and correct meta for first page', async () => {
      const items = [{ id: 1 }, { id: 2 }];
      const model = makeModel(items, 45);

      const result = await paginate(
        model,
        { page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' },
        {},
      );

      expect(result.data).toEqual(items);
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 45,
        totalPages: 3,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
    });

    it('should pass correct skip and take to findMany', async () => {
      const model = makeModel([], 0);

      await paginate(
        model,
        { page: 3, limit: 10, sortBy: 'id', sortOrder: 'asc' },
        {},
      );

      expect(model.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });

    it('should pass orderBy to findMany', async () => {
      const model = makeModel([], 0);

      await paginate(
        model,
        { page: 1, limit: 10, sortBy: 'name', sortOrder: 'asc' },
        {},
      );

      expect(model.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { name: 'asc' } }),
      );
    });

    it('should calculate totalPages = 1 when items fit in a single page', async () => {
      const model = makeModel([{ id: 1 }], 1);

      const result = await paginate(model, baseQuery, {});

      expect(result.meta.totalPages).toBe(1);
    });

    it('should calculate totalPages correctly when total is multiple of limit', async () => {
      const model = makeModel([], 40);

      const result = await paginate(model, { ...baseQuery, limit: 10 }, {});

      expect(result.meta.totalPages).toBe(4);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Search
  // ─────────────────────────────────────────────────────────────
  describe('search', () => {
    it('should add OR clause for search across searchFields', async () => {
      const model = makeModel([], 0);

      await paginate(
        model,
        { ...baseQuery, search: 'alice' },
        { searchFields: ['email', 'name'] },
      );

      expect(model.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { email: { contains: 'alice', mode: 'insensitive' } },
              { name: { contains: 'alice', mode: 'insensitive' } },
            ],
          },
        }),
      );
    });

    it('should not add OR clause when search is empty', async () => {
      const model = makeModel([], 0);

      await paginate(
        model,
        { ...baseQuery, search: undefined },
        { searchFields: ['email'] },
      );

      expect(model.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('should not add OR clause when searchFields is empty even with search', async () => {
      const model = makeModel([], 0);

      await paginate(
        model,
        { ...baseQuery, search: 'test' },
        { searchFields: [] },
      );

      const call = model.findMany.mock.calls[0][0];
      expect(call.where).not.toHaveProperty('OR');
    });

    it('should include search in meta when search is provided', async () => {
      const model = makeModel([], 0);

      const result = await paginate(
        model,
        { ...baseQuery, search: 'alice' },
        {},
      );

      expect(result.meta.search).toBe('alice');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // where + include + metaFilters
  // ─────────────────────────────────────────────────────────────
  describe('options: where, include, metaFilters', () => {
    it('should merge provided where clause with search', async () => {
      const model = makeModel([], 0);

      await paginate(
        model,
        { ...baseQuery, search: 'test' },
        { where: { isEmailChecked: true }, searchFields: ['name'] },
      );

      expect(model.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isEmailChecked: true,
            OR: [{ name: { contains: 'test', mode: 'insensitive' } }],
          },
        }),
      );
    });

    it('should pass include to findMany when provided', async () => {
      const model = makeModel([], 0);
      const include = { roles: { include: { role: true } } };

      await paginate(model, baseQuery, { include });

      expect(model.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ include }),
      );
    });

    it('should not pass include to findMany when not provided', async () => {
      const model = makeModel([], 0);

      await paginate(model, baseQuery, {});

      const call = model.findMany.mock.calls[0][0];
      expect(call).not.toHaveProperty('include');
    });

    it('should include filters in meta when metaFilters are non-empty', async () => {
      const model = makeModel([], 0);

      const result = await paginate(model, baseQuery, {
        metaFilters: { role: 'ADMIN' },
      });

      expect(result.meta.filters).toEqual({ role: 'ADMIN' });
    });

    it('should not include filters in meta when metaFilters is empty', async () => {
      const model = makeModel([], 0);

      const result = await paginate(model, baseQuery, { metaFilters: {} });

      expect(result.meta).not.toHaveProperty('filters');
    });
  });
});
