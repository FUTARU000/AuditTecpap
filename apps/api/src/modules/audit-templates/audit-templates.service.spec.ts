import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import type { AuditLogService } from '../audit-log/audit-log.service';
import type { PrismaService } from '../prisma/prisma.service';
import { AuditTemplatesService } from './audit-templates.service';

const ACTOR = { actorId: 'u1', ipAddress: null, userAgent: null };

function detailTemplate(overrides: Partial<{ status: string; name: string; id: string }> = {}) {
  return {
    id: 't1', name: overrides.name ?? 'Template', description: null, category: 'Quality Audit', version: 1, status: overrides.status ?? 'DRAFT',
    departmentId: null, processId: null, createdById: 'u1', createdAt: new Date(0), updatedAt: new Date(0),
    department: null, process: null, createdBy: { firstName: 'A', lastName: 'B' }, sections: [],
  };
}

describe('AuditTemplatesService', () => {
  type MockFn = ReturnType<typeof vi.fn>;
  let service: AuditTemplatesService;
  let prisma: { auditTemplate: { findUnique: MockFn; findMany: MockFn; count: MockFn; create: MockFn; update: MockFn; delete: MockFn }; $transaction: MockFn };

  beforeEach(() => {
    prisma = { auditTemplate: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() }, $transaction: vi.fn() };
    service = new AuditTemplatesService(prisma as unknown as PrismaService, { record: vi.fn() } as unknown as AuditLogService, { record: vi.fn() } as unknown as ActivityTimelineService);
  });

  it('publishes a template', async () => {
    prisma.auditTemplate.update.mockResolvedValue(detailTemplate({ status: 'PUBLISHED' }));
    const template = await service.publish('t1', ACTOR);
    expect(template.status).toBe('PUBLISHED');
    expect(prisma.auditTemplate.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 't1' }, data: expect.objectContaining({ status: 'PUBLISHED' }) }));
  });

  it('clones a template into a new draft', async () => {
    prisma.auditTemplate.findUnique.mockResolvedValue(detailTemplate({ name: 'Source' }));
    prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = { auditTemplate: { create: vi.fn().mockResolvedValue({ id: 't2' }), findUnique: vi.fn().mockResolvedValue(detailTemplate({ id: 't2', name: 'Source (copy)', status: 'DRAFT' })) }, auditTemplateSection: { create: vi.fn().mockResolvedValue({ id: 's1' }) }, auditTemplateQuestion: { create: vi.fn() } };
      return cb(tx);
    });
    const clone = await service.clone('t1', ACTOR);
    expect(clone.name).toBe('Source (copy)');
    expect(clone.status).toBe('DRAFT');
  });
});
