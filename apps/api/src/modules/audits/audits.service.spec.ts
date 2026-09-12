import { ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import type { AuditLogService } from '../audit-log/audit-log.service';
import type { PrismaService } from '../prisma/prisma.service';
import { AuditsService } from './audits.service';

const ACTOR = { actorId: 'u1', ipAddress: null, userAgent: null };

describe('AuditsService (lifecycle & validation)', () => {
  type MockFn = ReturnType<typeof vi.fn>;
  let service: AuditsService;
  let prisma: {
    auditTemplate: { findUnique: MockFn };
    audit: {
      findUnique: MockFn;
      findFirst: MockFn;
      findMany: MockFn;
      count: MockFn;
      create: MockFn;
      update: MockFn;
      delete: MockFn;
      aggregate: MockFn;
    };
    auditAnswer: { upsert: MockFn };
  };

  beforeEach(() => {
    prisma = {
      auditTemplate: { findUnique: vi.fn() },
      audit: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        aggregate: vi.fn(),
      },
      auditAnswer: { upsert: vi.fn() },
    };
    service = new AuditsService(
      prisma as unknown as PrismaService,
      { record: vi.fn() } as unknown as AuditLogService,
      { record: vi.fn() } as unknown as ActivityTimelineService,
    );
  });

  it('refuses to create an audit from a non-published template', async () => {
    prisma.auditTemplate.findUnique.mockResolvedValue({ id: 't1', status: 'DRAFT' });
    await expect(
      service.create({ title: 'A', templateId: 't1', departmentId: 'd1' }, ACTOR),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.audit.create).not.toHaveBeenCalled();
  });

  it('creates an audit from a published template', async () => {
    prisma.auditTemplate.findUnique.mockResolvedValue({ id: 't1', status: 'PUBLISHED' });
    prisma.audit.create.mockResolvedValue({
      id: 'a1',
      title: 'A',
      templateId: 't1',
      departmentId: 'd1',
      processId: null,
      auditorId: null,
      status: 'PLANNED',
      scheduledDate: null,
      startedAt: null,
      submittedAt: null,
      approvedAt: null,
      approvedById: null,
      score: null,
      compliance: null,
      createdById: 'u1',
      createdAt: new Date(0),
      updatedAt: new Date(0),
      template: { id: 't1', name: 'T', sections: [{ _count: { questions: 2 } }] },
      answers: [],
      department: { name: 'Production' },
      process: null,
      auditor: null,
      approvedBy: null,
      _count: { findings: 0, evidence: 0 },
    });
    const audit = await service.create({ title: 'A', templateId: 't1', departmentId: 'd1' }, ACTOR);
    expect(audit.id).toBe('a1');
    expect(audit.status).toBe('PLANNED');
  });

  it('rejects submitting an audit that is still planned', async () => {
    prisma.audit.findUnique.mockResolvedValue({
      id: 'a1',
      status: 'PLANNED',
      startedAt: null,
      processId: null,
      title: 'A',
    });
    await expect(service.submit('a1', ACTOR)).rejects.toBeInstanceOf(ConflictException);
  });

  describe('duplicate-name prevention', () => {
    it('rejects creating an audit whose normalized title collides with an existing one', async () => {
      prisma.auditTemplate.findUnique.mockResolvedValue({ id: 't1', status: 'PUBLISHED' });
      prisma.audit.findFirst.mockResolvedValue({ id: 'existing-audit' });
      await expect(
        service.create(
          { title: '  Internal Audit 2026  ', templateId: 't1', departmentId: 'd1' },
          ACTOR,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.audit.create).not.toHaveBeenCalled();
    });

    it('treats case and whitespace variants as the same name', async () => {
      prisma.auditTemplate.findUnique.mockResolvedValue({ id: 't1', status: 'PUBLISHED' });
      prisma.audit.findFirst.mockResolvedValue({ id: 'existing-audit' });
      await expect(
        service.create(
          { title: 'internal audit 2026', templateId: 't1', departmentId: 'd1' },
          ACTOR,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
