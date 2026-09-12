import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditLogService } from '../audit-log/audit-log.service';
import type { NotificationService } from '../productivity/notification.service';
import type { PrismaService } from '../prisma/prisma.service';
import { IndicatorsService } from './indicators.service';

const ACTOR = { actorId: 'u1', ipAddress: null, userAgent: null };
const GLOBAL_SCOPE = { role: 'audit-manager', departmentId: null, isGlobal: true };
const PILOT_SCOPE_A = { role: 'pilot', departmentId: 'dept-a', isGlobal: false };

const INDICATOR_ROW = {
  id: 'ind-1',
  code: 'QUAL-01',
  name: 'Compliance rate',
  description: null,
  departmentId: 'dept-a',
  department: { id: 'dept-a', name: 'Quality' },
  category: 'Quality',
  unit: '%',
  direction: 'HIGHER_IS_BETTER' as const,
  target: 95,
  warningThreshold: 85,
  criticalThreshold: 70,
  frequency: 'MONTHLY' as const,
  responsibleUserId: 'pilot-1',
  responsible: { id: 'pilot-1', firstName: 'Jane', lastName: 'Doe' },
  active: true,
  createdById: 'u1',
  createdBy: { id: 'u1', firstName: 'Admin', lastName: 'User' },
  values: [],
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

function buildPrismaMock() {
  return {
    indicator: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    indicatorValue: {
      findMany: vi.fn(),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
    },
    department: { findUnique: vi.fn() },
    user: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
  };
}

function buildService(prisma: ReturnType<typeof buildPrismaMock>) {
  return new IndicatorsService(
    prisma as unknown as PrismaService,
    { record: vi.fn() } as unknown as AuditLogService,
    { emit: vi.fn().mockResolvedValue(null) } as unknown as NotificationService,
  );
}

describe('IndicatorsService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(() => {
    prisma = buildPrismaMock();
  });

  describe('create', () => {
    it('creates an indicator when the department and responsible user are valid', async () => {
      prisma.department.findUnique.mockResolvedValue({ id: 'dept-a' });
      prisma.user.findUnique.mockResolvedValue({ departmentId: 'dept-a' });
      prisma.indicator.findUnique.mockResolvedValue(null);
      prisma.indicator.create.mockResolvedValue(INDICATOR_ROW);
      const service = buildService(prisma);

      const result = await service.create(
        {
          code: 'QUAL-01',
          name: 'Compliance rate',
          departmentId: 'dept-a',
          responsibleUserId: 'pilot-1',
        },
        ACTOR,
        GLOBAL_SCOPE,
      );
      expect(result.code).toBe('QUAL-01');
      expect(prisma.indicator.create).toHaveBeenCalledTimes(1);
    });

    it('rejects a duplicate code', async () => {
      prisma.department.findUnique.mockResolvedValue({ id: 'dept-a' });
      prisma.indicator.findUnique.mockResolvedValue({ id: 'existing' });
      const service = buildService(prisma);

      await expect(
        service.create({ code: 'QUAL-01', name: 'X', departmentId: 'dept-a' }, ACTOR, GLOBAL_SCOPE),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects a responsible user from a different department', async () => {
      prisma.department.findUnique.mockResolvedValue({ id: 'dept-a' });
      prisma.user.findUnique.mockResolvedValue({ departmentId: 'dept-b' });
      const service = buildService(prisma);

      await expect(
        service.create(
          { code: 'QUAL-01', name: 'X', departmentId: 'dept-a', responsibleUserId: 'someone-else' },
          ACTOR,
          GLOBAL_SCOPE,
        ),
      ).rejects.toThrow(/responsible user must belong/);
    });

    it('rejects a department-scoped caller creating an indicator outside their own department', async () => {
      const service = buildService(prisma);
      await expect(
        service.create(
          { code: 'QUAL-01', name: 'X', departmentId: 'dept-b' },
          ACTOR,
          PILOT_SCOPE_A,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.indicator.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates fields and re-validates the responsible user against the (possibly new) department', async () => {
      prisma.indicator.findUnique.mockResolvedValue({
        ...INDICATOR_ROW,
        responsible: undefined,
        department: undefined,
        createdBy: undefined,
      });
      prisma.user.findUnique.mockResolvedValue({ departmentId: 'dept-a' });
      prisma.indicator.update.mockResolvedValue({ ...INDICATOR_ROW, name: 'Updated name' });
      const service = buildService(prisma);

      const result = await service.update(
        'ind-1',
        { name: 'Updated name', responsibleUserId: 'pilot-1' },
        ACTOR,
        GLOBAL_SCOPE,
      );
      expect(result.name).toBe('Updated name');
    });

    it('rejects a department-scoped caller editing an indicator outside their own department', async () => {
      prisma.indicator.findUnique.mockResolvedValue({ ...INDICATOR_ROW, departmentId: 'dept-b' });
      const service = buildService(prisma);

      await expect(
        service.update('ind-1', { name: 'X' }, ACTOR, PILOT_SCOPE_A),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.indicator.update).not.toHaveBeenCalled();
    });

    it('404s when the indicator does not exist', async () => {
      prisma.indicator.findUnique.mockResolvedValue(null);
      const service = buildService(prisma);
      await expect(
        service.update('missing', { name: 'X' }, ACTOR, GLOBAL_SCOPE),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('department-scoped visibility (list/findOne)', () => {
    it('list() forces a department-scoped caller to only their own department, regardless of a departmentId query param', async () => {
      prisma.indicator.findMany.mockResolvedValue([]);
      const service = buildService(prisma);

      await service.list({ departmentId: 'dept-b' } as never, PILOT_SCOPE_A);
      const where = prisma.indicator.findMany.mock.calls[0]![0].where;
      expect(where.departmentId).toBe('dept-a'); // scope wins over the requested query param
    });

    it('findOne() 404s for an indicator in another department (no existence leak)', async () => {
      prisma.indicator.findFirst.mockResolvedValue(null); // scoped where excludes it
      const service = buildService(prisma);
      await expect(service.findOne('ind-1', PILOT_SCOPE_A)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('recordValue', () => {
    it('records a value, preserves history, and does not notify when on target', async () => {
      prisma.indicator.findUnique.mockResolvedValue(INDICATOR_ROW); // MONTHLY
      prisma.indicatorValue.create.mockResolvedValue({
        id: 'v1',
        value: 97,
        year: 2026,
        periodMonth: 2,
        measuredAt: new Date('2026-02-28'),
        comment: null,
        recordedById: 'u1',
        createdAt: new Date('2026-02-01'),
        updatedAt: new Date('2026-02-01'),
        recordedBy: null,
      });
      const notifications = {
        emit: vi.fn().mockResolvedValue(null),
      } as unknown as NotificationService;
      const service = new IndicatorsService(
        prisma as unknown as PrismaService,
        { record: vi.fn() } as unknown as AuditLogService,
        notifications,
      );

      const result = await service.recordValue(
        'ind-1',
        { value: 97, year: 2026, periodMonth: 2 },
        ACTOR,
        GLOBAL_SCOPE,
      );
      expect(result.value).toBe(97);
      expect(prisma.indicatorValue.create).toHaveBeenCalledTimes(1);
      expect(prisma.indicatorValue.update).not.toHaveBeenCalled();
      expect(notifications.emit as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
    });

    it('notifies the responsible user and global managers when a value crosses the critical threshold', async () => {
      prisma.indicator.findUnique.mockResolvedValue(INDICATOR_ROW); // criticalThreshold: 70, HIGHER_IS_BETTER
      prisma.indicatorValue.create.mockResolvedValue({
        id: 'v2',
        value: 60,
        year: 2026,
        periodMonth: 2,
        measuredAt: new Date('2026-02-28'),
        comment: null,
        recordedById: 'u1',
        createdAt: new Date('2026-02-01'),
        updatedAt: new Date('2026-02-01'),
        recordedBy: null,
      });
      prisma.user.findMany.mockResolvedValue([{ id: 'manager-1' }]);
      const notifications = {
        emit: vi.fn().mockResolvedValue(null),
      } as unknown as NotificationService;
      const service = new IndicatorsService(
        prisma as unknown as PrismaService,
        { record: vi.fn() } as unknown as AuditLogService,
        notifications,
      );

      await service.recordValue(
        'ind-1',
        { value: 60, year: 2026, periodMonth: 2 },
        ACTOR,
        GLOBAL_SCOPE,
      );

      const emit = notifications.emit as ReturnType<typeof vi.fn>;
      expect(emit).toHaveBeenCalledTimes(2); // responsible pilot + the one global manager
      const calledUserIds = emit.mock.calls.map((c) => c[0].userId).sort();
      expect(calledUserIds).toEqual(['manager-1', 'pilot-1']);
      expect(emit.mock.calls[0]![0]).toMatchObject({
        type: 'INDICATOR_THRESHOLD_EXCEEDED',
        severity: 'CRITICAL',
        entityId: 'ind-1',
      });
    });

    it("rejects recording a value for an indicator outside the caller's department (no existence leak)", async () => {
      prisma.indicator.findUnique.mockResolvedValue({ ...INDICATOR_ROW, departmentId: 'dept-b' });
      const service = buildService(prisma);

      await expect(
        service.recordValue(
          'ind-1',
          { value: 50, year: 2026, periodMonth: 2 },
          ACTOR,
          PILOT_SCOPE_A,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.indicatorValue.create).not.toHaveBeenCalled();
    });

    it('allows a pilot to record a value for an indicator in their own department', async () => {
      prisma.indicator.findUnique.mockResolvedValue(INDICATOR_ROW); // departmentId: dept-a
      prisma.indicatorValue.create.mockResolvedValue({
        id: 'v3',
        value: 96,
        year: 2026,
        periodMonth: 2,
        measuredAt: new Date('2026-02-28'),
        comment: null,
        recordedById: 'u1',
        createdAt: new Date('2026-02-01'),
        updatedAt: new Date('2026-02-01'),
        recordedBy: null,
      });
      const service = buildService(prisma);

      const result = await service.recordValue(
        'ind-1',
        { value: 96, year: 2026, periodMonth: 2 },
        ACTOR,
        PILOT_SCOPE_A,
      );
      expect(result.value).toBe(96);
    });

    it('updates the existing row instead of creating a duplicate when a value already exists for that period (duplicate-period protection)', async () => {
      prisma.indicator.findUnique.mockResolvedValue(INDICATOR_ROW);
      prisma.indicatorValue.findFirst.mockResolvedValue({ id: 'existing-v', value: 90 });
      prisma.indicatorValue.update.mockResolvedValue({
        id: 'existing-v',
        value: 93,
        year: 2026,
        periodMonth: 2,
        measuredAt: new Date('2026-02-28'),
        comment: 'corrected',
        recordedById: 'u1',
        createdAt: new Date('2026-02-01'),
        updatedAt: new Date('2026-02-15'),
        recordedBy: null,
      });
      const service = buildService(prisma);

      const result = await service.recordValue(
        'ind-1',
        { value: 93, year: 2026, periodMonth: 2, comment: 'corrected' },
        ACTOR,
        GLOBAL_SCOPE,
      );
      expect(result.id).toBe('existing-v');
      expect(result.value).toBe(93);
      expect(prisma.indicatorValue.update).toHaveBeenCalledTimes(1);
      expect(prisma.indicatorValue.create).not.toHaveBeenCalled();
    });

    describe('period validation per frequency', () => {
      it('MONTHLY accepts all 12 months', async () => {
        prisma.indicator.findUnique.mockResolvedValue({ ...INDICATOR_ROW, frequency: 'MONTHLY' });
        prisma.indicatorValue.create.mockResolvedValue({
          id: 'v',
          value: 1,
          year: 2026,
          periodMonth: 1,
          measuredAt: new Date(),
          comment: null,
          recordedById: 'u1',
          createdAt: new Date(),
          updatedAt: new Date(),
          recordedBy: null,
        });
        const service = buildService(prisma);
        for (let month = 1; month <= 12; month++) {
          await expect(
            service.recordValue(
              'ind-1',
              { value: 1, year: 2026, periodMonth: month },
              ACTOR,
              GLOBAL_SCOPE,
            ),
          ).resolves.toBeDefined();
        }
      });

      it('QUARTERLY accepts only Mar/Jun/Sep/Dec and rejects other months', async () => {
        prisma.indicator.findUnique.mockResolvedValue({ ...INDICATOR_ROW, frequency: 'QUARTERLY' });
        prisma.indicatorValue.create.mockResolvedValue({
          id: 'v',
          value: 1,
          year: 2026,
          periodMonth: 3,
          measuredAt: new Date(),
          comment: null,
          recordedById: 'u1',
          createdAt: new Date(),
          updatedAt: new Date(),
          recordedBy: null,
        });
        const service = buildService(prisma);
        for (const month of [3, 6, 9, 12]) {
          await expect(
            service.recordValue(
              'ind-1',
              { value: 1, year: 2026, periodMonth: month },
              ACTOR,
              GLOBAL_SCOPE,
            ),
          ).resolves.toBeDefined();
        }
        for (const month of [1, 2, 4, 5, 7, 8, 10, 11]) {
          await expect(
            service.recordValue(
              'ind-1',
              { value: 1, year: 2026, periodMonth: month },
              ACTOR,
              GLOBAL_SCOPE,
            ),
          ).rejects.toBeInstanceOf(BadRequestException);
        }
      });

      it('SEMIANNUAL accepts only Jun/Dec and rejects other months', async () => {
        prisma.indicator.findUnique.mockResolvedValue({
          ...INDICATOR_ROW,
          frequency: 'SEMIANNUAL',
        });
        prisma.indicatorValue.create.mockResolvedValue({
          id: 'v',
          value: 1,
          year: 2026,
          periodMonth: 6,
          measuredAt: new Date(),
          comment: null,
          recordedById: 'u1',
          createdAt: new Date(),
          updatedAt: new Date(),
          recordedBy: null,
        });
        const service = buildService(prisma);
        for (const month of [6, 12]) {
          await expect(
            service.recordValue(
              'ind-1',
              { value: 1, year: 2026, periodMonth: month },
              ACTOR,
              GLOBAL_SCOPE,
            ),
          ).resolves.toBeDefined();
        }
        for (const month of [1, 3, 5, 7, 9, 11]) {
          await expect(
            service.recordValue(
              'ind-1',
              { value: 1, year: 2026, periodMonth: month },
              ACTOR,
              GLOBAL_SCOPE,
            ),
          ).rejects.toBeInstanceOf(BadRequestException);
        }
      });

      it('ANNUAL accepts only December', async () => {
        prisma.indicator.findUnique.mockResolvedValue({ ...INDICATOR_ROW, frequency: 'ANNUAL' });
        prisma.indicatorValue.create.mockResolvedValue({
          id: 'v',
          value: 1,
          year: 2026,
          periodMonth: 12,
          measuredAt: new Date(),
          comment: null,
          recordedById: 'u1',
          createdAt: new Date(),
          updatedAt: new Date(),
          recordedBy: null,
        });
        const service = buildService(prisma);
        await expect(
          service.recordValue(
            'ind-1',
            { value: 1, year: 2026, periodMonth: 12 },
            ACTOR,
            GLOBAL_SCOPE,
          ),
        ).resolves.toBeDefined();
        for (const month of [1, 3, 6, 9]) {
          await expect(
            service.recordValue(
              'ind-1',
              { value: 1, year: 2026, periodMonth: month },
              ACTOR,
              GLOBAL_SCOPE,
            ),
          ).rejects.toBeInstanceOf(BadRequestException);
        }
      });
    });
  });

  describe('getPeriodGrid', () => {
    it('returns all 12 months, marking only the frequency-applicable ones and never fabricating zero values', async () => {
      prisma.indicator.findFirst.mockResolvedValue({ frequency: 'QUARTERLY' });
      prisma.indicatorValue.findMany.mockResolvedValue([
        {
          id: 'v1',
          value: 85,
          year: 2026,
          periodMonth: 3,
          measuredAt: new Date('2026-03-31'),
          comment: null,
          recordedById: 'u1',
          createdAt: new Date('2026-03-01'),
          updatedAt: new Date('2026-03-01'),
          recordedBy: null,
        },
        {
          id: 'v2',
          value: 90,
          year: 2026,
          periodMonth: 6,
          measuredAt: new Date('2026-06-30'),
          comment: null,
          recordedById: 'u1',
          createdAt: new Date('2026-06-01'),
          updatedAt: new Date('2026-06-01'),
          recordedBy: null,
        },
      ]);
      const service = buildService(prisma);

      const grid = await service.getPeriodGrid('ind-1', 2026, GLOBAL_SCOPE);
      expect(grid.periods).toHaveLength(12);
      expect(grid.periods.map((p) => p.applicable)).toEqual([
        false,
        false,
        true,
        false,
        false,
        true,
        false,
        false,
        true,
        false,
        false,
        true,
      ]);
      expect(grid.periods[2]!.value?.value).toBe(85); // March
      expect(grid.periods[5]!.value?.value).toBe(90); // June
      expect(grid.periods[8]!.value).toBeNull(); // September — applicable but no data yet, not zero
      expect(grid.periods[0]!.value).toBeNull(); // January — not applicable at all
    });

    it("404s for an indicator outside the caller's department", async () => {
      prisma.indicator.findFirst.mockResolvedValue(null); // scoped where excludes it
      const service = buildService(prisma);
      await expect(service.getPeriodGrid('ind-1', 2026, PILOT_SCOPE_A)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('setActive', () => {
    it('deactivates an indicator', async () => {
      prisma.indicator.findUnique.mockResolvedValue(INDICATOR_ROW);
      prisma.indicator.update.mockResolvedValue({ ...INDICATOR_ROW, active: false });
      const service = buildService(prisma);

      const result = await service.setActive('ind-1', false, ACTOR, GLOBAL_SCOPE);
      expect(result.active).toBe(false);
    });

    it("rejects a department-scoped caller deactivating another department's indicator", async () => {
      prisma.indicator.findUnique.mockResolvedValue({ ...INDICATOR_ROW, departmentId: 'dept-b' });
      const service = buildService(prisma);
      await expect(service.setActive('ind-1', false, ACTOR, PILOT_SCOPE_A)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });
});
