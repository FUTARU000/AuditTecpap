import { describe, expect, it } from 'vitest';
import { paginated, parsePagination, parseSort } from './pagination';

describe('parsePagination', () => {
  it('applies defaults', () => {
    const result = parsePagination({});
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.skip).toBe(0);
  });

  it('parses string inputs from query params', () => {
    const result = parsePagination({ page: '3', pageSize: '5' });
    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(5);
    expect(result.skip).toBe(10);
  });

  it('clamps pageSize to the configured maximum', () => {
    expect(parsePagination({ pageSize: '999' }).pageSize).toBe(100);
  });

  it('falls back when values are invalid', () => {
    expect(parsePagination({ page: 'abc' }).page).toBe(1);
  });
});

describe('paginated', () => {
  it('computes total pages', () => {
    expect(paginated([1, 2, 3], 25, 1, 10).totalPages).toBe(3);
  });

  it('returns 0 pages for an empty set', () => {
    expect(paginated([], 0, 1, 10).totalPages).toBe(0);
  });
});

describe('parseSort', () => {
  it('falls back when no sort provided', () => {
    expect(parseSort(undefined, ['name'])).toEqual([{ createdAt: 'desc' }]);
  });

  it('parses ascending', () => {
    expect(parseSort('name', ['name'])).toEqual([{ name: 'asc' }]);
  });

  it('parses descending with a leading dash', () => {
    expect(parseSort('-name', ['name'])).toEqual([{ name: 'desc' }]);
  });

  it('falls back for a non-allow-listed field', () => {
    expect(parseSort('password', ['name'])).toEqual([{ createdAt: 'desc' }]);
  });
});
