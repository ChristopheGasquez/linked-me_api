import { PaginationQueryDto } from './pagination-query.dto.js';
import { PaginatedResponse } from './paginated-response.dto.js';

export interface PaginateOptions {
  searchFields?: string[];
  where?: Record<string, unknown>;
  include?: Record<string, unknown>;
  metaFilters?: Record<string, unknown>;
}

export async function paginate<T>(
  model: {
    findMany: (args: any) => Promise<T[]>;
    count: (args: any) => Promise<number>;
  },
  query: PaginationQueryDto,
  options: PaginateOptions = {},
): Promise<PaginatedResponse<T>> {
  const { page, limit, sortBy, sortOrder, search } = query;
  const { searchFields = [], where = {}, include, metaFilters } = options;

  const whereClause: Record<string, unknown> = { ...where };

  if (search && searchFields.length > 0) {
    whereClause.OR = searchFields.map((field) => ({
      [field]: { contains: search, mode: 'insensitive' },
    }));
  }

  const [data, total] = await Promise.all([
    model.findMany({
      where: whereClause,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
      ...(include && { include }),
    }),
    model.count({ where: whereClause }),
  ]);

  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      sortBy,
      sortOrder,
      ...(search && { search }),
      ...(metaFilters &&
        Object.keys(metaFilters).length > 0 && { filters: metaFilters }),
    },
  };
}
