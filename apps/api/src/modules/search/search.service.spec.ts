import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import { SearchService } from './search.service';

describe('SearchService', () => {
  it('returns empty for terms shorter than 2 characters without hitting the DB', async () => {
    const prisma = {
      process: { findMany: vi.fn() },
      controlledDocument: { findMany: vi.fn() },
      businessObject: { findMany: vi.fn() },
      kpi: { findMany: vi.fn() },
      processRisk: { findMany: vi.fn() },
    };
    const service = new SearchService(prisma as unknown as PrismaService);
    const result = await service.search('a', undefined);
    expect(result.total).toBe(0);
    expect(result.groups).toEqual([]);
    expect(prisma.process.findMany).not.toHaveBeenCalled();
  });

  it('groups results by entity and omits empty groups', async () => {
    const prisma = {
      process: { findMany: vi.fn().mockResolvedValue([{ id: 'p1', name: 'Molding', department: { name: 'Production' } }]) },
      controlledDocument: { findMany: vi.fn().mockResolvedValue([{ id: 'd1', title: 'SOP Molding', code: 'SOP-1', department: { name: 'Production' } }]) },
      businessObject: { findMany: vi.fn().mockResolvedValue([]) },
      kpi: { findMany: vi.fn().mockResolvedValue([]) },
      processRisk: { findMany: vi.fn().mockResolvedValue([]) },
      auditTemplate: { findMany: vi.fn().mockResolvedValue([]) },
      audit: { findMany: vi.fn().mockResolvedValue([]) },
      finding: { findMany: vi.fn().mockResolvedValue([]) },
      capa: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = new SearchService(prisma as unknown as PrismaService);
    const result = await service.search('molding', undefined);
    expect(result.total).toBe(2);
    expect(result.groups.map((group) => group.type)).toEqual(['process', 'document']);
    expect(result.groups[0]?.results[0]?.title).toBe('Molding');
  });
});
