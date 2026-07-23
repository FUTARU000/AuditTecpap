import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@tecpap/config';
import type { PaginatedResult } from '@tecpap/types';

/** Loose input shape — query params arrive as strings, but some callers pass numbers. */
export interface PaginationInput {
  page?: string | number;
  pageSize?: string | number;
  search?: string;
  sort?: string;
}

export interface ParsedPagination {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
  sort: string | undefined;
  search: string | undefined;
}

/** Normalize pagination/sort/search params into Prisma-friendly values. */
export function parsePagination(query: PaginationInput = {}): ParsedPagination {
  const page = Math.max(1, Math.floor(Number(query.page ?? 1)) || 1);
  const requested = Math.floor(Number(query.pageSize ?? DEFAULT_PAGE_SIZE)) || DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, requested));
  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
    sort: query.sort,
    search: query.search,
  };
}

export function paginated<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
): PaginatedResult<T> {
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 0,
  };
}

type OrderBy = Record<string, 'asc' | 'desc'>;

/** Convert '?sort=-field' / '?sort=field' into a Prisma orderBy, allow-listed. */
export function parseSort(
  sort: string | undefined,
  allowed: readonly string[],
  fallback: OrderBy = { createdAt: 'desc' },
): OrderBy[] {
  if (!sort) {
    return [fallback];
  }
  const descending = sort.startsWith('-');
  const field = descending ? sort.slice(1) : sort;
  if (!allowed.includes(field)) {
    return [fallback];
  }
  return [{ [field]: descending ? 'desc' : 'asc' }];
}
