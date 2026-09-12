import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { INDICATOR_FREQUENCY_VALID_MONTHS } from '@tecpap/config';
import type {
  IndicatorDetailDto,
  IndicatorDto,
  IndicatorEvaluationStatus,
  IndicatorPeriodGridDto,
  IndicatorValueDto,
  PaginatedResult,
} from '@tecpap/types';
import type { ActorContext } from '../../common/context/actor';
import { paginated, parsePagination, parseSort } from '../../common/pagination/pagination';
import { departmentScopeWhere } from '../../common/scoping/scope';
import type { DataScope } from '../../common/types/data-scope';
import { AuditLogService } from '../audit-log/audit-log.service';
import { NotificationService } from '../productivity/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateIndicatorDto,
  ListIndicatorsQuery,
  RecordIndicatorValueDto,
  UpdateIndicatorDto,
} from './dto/indicators.dto';
import { evaluateIndicator } from './indicator-evaluation.util';

const INDICATOR_INCLUDE = {
  department: { select: { id: true, name: true } },
  responsible: { select: { id: true, firstName: true, lastName: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  values: {
    orderBy: [
      { year: 'desc' as const },
      { periodMonth: 'desc' as const },
      { createdAt: 'desc' as const },
    ],
    take: 1,
  },
} satisfies Prisma.IndicatorInclude;

type IndicatorRow = Prisma.IndicatorGetPayload<{ include: typeof INDICATOR_INCLUDE }>;
type ValueRow = {
  id: string;
  value: number;
  year: number;
  periodMonth: number;
  measuredAt: Date;
  comment: string | null;
  recordedById: string | null;
  createdAt: Date;
  updatedAt: Date;
  recordedBy?: { firstName: string; lastName: string } | null;
};

function fullName(user: { firstName: string; lastName: string } | null | undefined): string | null {
  return user ? `${user.firstName} ${user.lastName}` : null;
}

@Injectable()
export class IndicatorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly notifications: NotificationService,
  ) {}

  async list(
    query: ListIndicatorsQuery,
    scope: DataScope | undefined,
  ): Promise<PaginatedResult<IndicatorDto>> {
    const { page, pageSize, sort, search } = parsePagination(query);
    const base: Prisma.IndicatorWhereInput = {
      ...(query.category ? { category: query.category } : {}),
      ...(query.active !== undefined ? { active: query.active === 'true' } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
              { category: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const where = departmentScopeWhere(scope, {
      ...base,
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
    }) as Prisma.IndicatorWhereInput;

    const rows = await this.prisma.indicator.findMany({
      where,
      include: INDICATOR_INCLUDE,
      orderBy: parseSort(sort, ['name', 'code', 'category', 'createdAt', 'updatedAt'], {
        name: 'asc',
      }),
    });
    let items = rows.map((row) => this.toDto(row));
    if (query.status) {
      items = items.filter((item) => item.status === query.status);
    }
    const total = items.length;
    const start = (page - 1) * pageSize;
    return paginated(items.slice(start, start + pageSize), total, page, pageSize);
  }

  async findOne(id: string, scope: DataScope | undefined): Promise<IndicatorDetailDto> {
    const row = await this.prisma.indicator.findFirst({
      where: { id, ...(departmentScopeWhere(scope) as Prisma.IndicatorWhereInput) },
      include: INDICATOR_INCLUDE,
    });
    if (!row) throw new NotFoundException('Indicator not found');
    const values = await this.listValues(id, scope);
    return { ...this.toDto(row), values };
  }

  /** Full measurement history, oldest first — used by the detail page and the dedicated history endpoint. */
  async listValues(id: string, scope: DataScope | undefined): Promise<IndicatorValueDto[]> {
    await this.assertVisible(id, scope);
    const values = await this.prisma.indicatorValue.findMany({
      where: { indicatorId: id },
      orderBy: [{ year: 'asc' }, { periodMonth: 'asc' }, { createdAt: 'asc' }],
      include: { recordedBy: { select: { firstName: true, lastName: true } } },
    });
    return values.map((v) => this.toValueDto(v));
  }

  /**
   * The 12-month grid for one year. Always returns all 12 months; `applicable`
   * marks which ones the indicator's frequency actually accepts (e.g. only
   * Mar/Jun/Sep/Dec for QUARTERLY) — non-applicable months always come back
   * with `value: null` rather than a fabricated zero. When a period has more
   * than one historical row (pre-dating this grid, from before periods were
   * tracked), the most recently created one is shown; nothing is discarded.
   */
  async getPeriodGrid(
    id: string,
    year: number,
    scope: DataScope | undefined,
  ): Promise<IndicatorPeriodGridDto> {
    const indicator = await this.prisma.indicator.findFirst({
      where: { id, ...(departmentScopeWhere(scope) as Prisma.IndicatorWhereInput) },
      select: { frequency: true },
    });
    if (!indicator) throw new NotFoundException('Indicator not found');

    const values = await this.prisma.indicatorValue.findMany({
      where: { indicatorId: id, year },
      orderBy: { createdAt: 'desc' },
      include: { recordedBy: { select: { firstName: true, lastName: true } } },
    });
    const latestByMonth = new Map<number, ValueRow>();
    for (const v of values) {
      if (!latestByMonth.has(v.periodMonth)) latestByMonth.set(v.periodMonth, v);
    }

    const validMonths = INDICATOR_FREQUENCY_VALID_MONTHS[indicator.frequency];
    const periods = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const raw = latestByMonth.get(month);
      return {
        month,
        applicable: validMonths.includes(month),
        value: raw ? this.toValueDto(raw) : null,
      };
    });
    return { year, frequency: indicator.frequency, periods };
  }

  async create(
    dto: CreateIndicatorDto,
    actor: ActorContext,
    scope: DataScope | undefined,
  ): Promise<IndicatorDto> {
    if (scope && !scope.isGlobal && dto.departmentId !== scope.departmentId) {
      throw new ForbiddenException('Cannot create an indicator outside your own department');
    }
    const department = await this.prisma.department.findUnique({ where: { id: dto.departmentId } });
    if (!department) throw new NotFoundException('Department not found');
    if (dto.responsibleUserId)
      await this.assertResponsibleInDepartment(dto.responsibleUserId, dto.departmentId);

    const existing = await this.prisma.indicator.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException('An indicator with this code already exists');

    const created = await this.prisma.indicator
      .create({
        data: {
          code: dto.code,
          name: dto.name,
          description: dto.description ?? null,
          departmentId: dto.departmentId,
          category: dto.category ?? null,
          unit: dto.unit ?? null,
          direction: dto.direction ?? 'HIGHER_IS_BETTER',
          target: dto.target ?? null,
          warningThreshold: dto.warningThreshold ?? null,
          criticalThreshold: dto.criticalThreshold ?? null,
          frequency: dto.frequency ?? 'MONTHLY',
          responsibleUserId: dto.responsibleUserId ?? null,
          createdById: actor.actorId!,
        },
        include: INDICATOR_INCLUDE,
      })
      .catch(() => {
        throw new ConflictException('An indicator with this code already exists');
      });

    await this.audit(actor, 'indicator.create', created.id, { code: created.code });
    return this.toDto(created);
  }

  async update(
    id: string,
    dto: UpdateIndicatorDto,
    actor: ActorContext,
    scope: DataScope | undefined,
  ): Promise<IndicatorDto> {
    const existing = await this.prisma.indicator.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Indicator not found');
    if (scope && !scope.isGlobal && existing.departmentId !== scope.departmentId) {
      throw new ForbiddenException('Cannot edit an indicator outside your own department');
    }
    if (
      dto.departmentId !== undefined &&
      scope &&
      !scope.isGlobal &&
      dto.departmentId !== scope.departmentId
    ) {
      throw new ForbiddenException('Cannot move an indicator to another department');
    }

    const finalDepartmentId = dto.departmentId ?? existing.departmentId;
    if (dto.responsibleUserId !== undefined && dto.responsibleUserId !== null) {
      await this.assertResponsibleInDepartment(dto.responsibleUserId, finalDepartmentId);
    }
    if (dto.departmentId !== undefined && dto.departmentId !== existing.departmentId) {
      const department = await this.prisma.department.findUnique({
        where: { id: dto.departmentId },
      });
      if (!department) throw new NotFoundException('Department not found');
      // If the department changes and no new responsible is given, the existing responsible may no longer belong — clear it defensively.
      if (dto.responsibleUserId === undefined && existing.responsibleUserId) {
        const stillValid = await this.prisma.user.findFirst({
          where: { id: existing.responsibleUserId, departmentId: dto.departmentId },
        });
        if (!stillValid) dto.responsibleUserId = null;
      }
    }

    if (dto.code !== undefined && dto.code !== existing.code) {
      const codeTaken = await this.prisma.indicator.findUnique({ where: { code: dto.code } });
      if (codeTaken) throw new ConflictException('An indicator with this code already exists');
    }

    const data: Prisma.IndicatorUpdateInput = {};
    if (dto.code !== undefined) data.code = dto.code;
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.departmentId !== undefined) data.department = { connect: { id: dto.departmentId } };
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.unit !== undefined) data.unit = dto.unit;
    if (dto.direction !== undefined) data.direction = dto.direction;
    if (dto.target !== undefined) data.target = dto.target;
    if (dto.warningThreshold !== undefined) data.warningThreshold = dto.warningThreshold;
    if (dto.criticalThreshold !== undefined) data.criticalThreshold = dto.criticalThreshold;
    if (dto.frequency !== undefined) data.frequency = dto.frequency;
    if (dto.responsibleUserId !== undefined)
      data.responsible = dto.responsibleUserId
        ? { connect: { id: dto.responsibleUserId } }
        : { disconnect: true };

    const updated = await this.prisma.indicator.update({
      where: { id },
      data,
      include: INDICATOR_INCLUDE,
    });
    await this.audit(actor, 'indicator.update', id);
    return this.toDto(updated);
  }

  async setActive(
    id: string,
    active: boolean,
    actor: ActorContext,
    scope: DataScope | undefined,
  ): Promise<IndicatorDto> {
    const existing = await this.prisma.indicator.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Indicator not found');
    if (scope && !scope.isGlobal && existing.departmentId !== scope.departmentId) {
      throw new ForbiddenException(
        `Cannot ${active ? 'activate' : 'deactivate'} an indicator outside your own department`,
      );
    }
    const updated = await this.prisma.indicator.update({
      where: { id },
      data: { active },
      include: INDICATOR_INCLUDE,
    });
    await this.audit(actor, active ? 'indicator.activate' : 'indicator.deactivate', id);
    return this.toDto(updated);
  }

  /**
   * Upserts by (indicatorId, year, periodMonth) rather than blindly inserting:
   * recording a second value for a period already on file is treated as a
   * correction to that period, not a new period. There is no DB-level unique
   * constraint enforcing this (live historical data pre-dates the period
   * columns and would violate one) — this check is the sole enforcement, and
   * it is what "duplicate-period protection" means for indicators specifically
   * (distinct from CAPA's append-only verification-attempt history).
   */
  async recordValue(
    id: string,
    dto: RecordIndicatorValueDto,
    actor: ActorContext,
    scope: DataScope | undefined,
  ): Promise<IndicatorValueDto> {
    const indicator = await this.prisma.indicator.findUnique({ where: { id } });
    if (!indicator) throw new NotFoundException('Indicator not found');
    if (scope && !scope.isGlobal && indicator.departmentId !== scope.departmentId) {
      throw new NotFoundException('Indicator not found');
    }

    const validMonths = INDICATOR_FREQUENCY_VALID_MONTHS[indicator.frequency];
    if (!validMonths.includes(dto.periodMonth)) {
      throw new BadRequestException(
        `Month ${dto.periodMonth} is not a valid period for a ${indicator.frequency.toLowerCase()} indicator. Valid periods: ${validMonths.join(', ')}.`,
      );
    }

    const measuredAt = new Date(Date.UTC(dto.year, dto.periodMonth, 0)); // last day of periodMonth
    const existing = await this.prisma.indicatorValue.findFirst({
      where: { indicatorId: id, year: dto.year, periodMonth: dto.periodMonth },
      orderBy: { createdAt: 'desc' },
    });

    const saved = existing
      ? await this.prisma.indicatorValue.update({
          where: { id: existing.id },
          data: {
            value: dto.value,
            measuredAt,
            comment: dto.comment ?? null,
            recordedById: actor.actorId,
          },
          include: { recordedBy: { select: { firstName: true, lastName: true } } },
        })
      : await this.prisma.indicatorValue.create({
          data: {
            indicatorId: id,
            value: dto.value,
            year: dto.year,
            periodMonth: dto.periodMonth,
            measuredAt,
            comment: dto.comment ?? null,
            recordedById: actor.actorId,
          },
          include: { recordedBy: { select: { firstName: true, lastName: true } } },
        });
    await this.audit(actor, existing ? 'indicator.value_updated' : 'indicator.value_recorded', id, {
      value: dto.value,
      year: dto.year,
      periodMonth: dto.periodMonth,
    });

    const status = evaluateIndicator({
      direction: indicator.direction,
      value: dto.value,
      target: indicator.target,
      warningThreshold: indicator.warningThreshold,
      criticalThreshold: indicator.criticalThreshold,
    });
    if (status === 'WARNING' || status === 'CRITICAL') {
      await this.notifyThresholdCrossed(indicator, status, dto.value);
    }

    return this.toValueDto(saved);
  }

  private async notifyThresholdCrossed(
    indicator: {
      id: string;
      name: string;
      unit: string | null;
      departmentId: string;
      responsibleUserId: string | null;
      warningThreshold: number | null;
      criticalThreshold: number | null;
    },
    status: 'WARNING' | 'CRITICAL',
    value: number,
  ): Promise<void> {
    const threshold =
      status === 'CRITICAL' ? indicator.criticalThreshold : indicator.warningThreshold;
    const params = {
      name: indicator.name,
      value,
      unit: indicator.unit ?? '',
      threshold: threshold ?? '',
      level: status,
    };
    const recipients = new Set<string>();
    if (indicator.responsibleUserId) recipients.add(indicator.responsibleUserId);
    const managers = await this.prisma.user.findMany({
      where: { role: { isGlobal: true }, status: 'ACTIVE', deletedAt: null },
      select: { id: true },
    });
    for (const m of managers) recipients.add(m.id);

    for (const userId of recipients) {
      await this.notifications
        .emit({
          userId,
          type: 'INDICATOR_THRESHOLD_EXCEEDED',
          category: 'indicator',
          severity: status,
          params,
          entityType: 'indicator',
          entityId: indicator.id,
          actionUrl: `/indicators/${indicator.id}`,
          departmentId: indicator.departmentId,
        })
        .catch(() => undefined);
    }
  }

  private async assertVisible(id: string, scope: DataScope | undefined): Promise<void> {
    const row = await this.prisma.indicator.findFirst({
      where: { id, ...(departmentScopeWhere(scope) as Prisma.IndicatorWhereInput) },
      select: { id: true },
    });
    if (!row) throw new NotFoundException('Indicator not found');
  }

  private async assertResponsibleInDepartment(
    responsibleUserId: string,
    departmentId: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: responsibleUserId },
      select: { departmentId: true },
    });
    if (!user) throw new NotFoundException('Responsible user not found');
    if (user.departmentId !== departmentId) {
      throw new BadRequestException(
        "The responsible user must belong to the indicator's department",
      );
    }
  }

  private toValueDto(value: ValueRow): IndicatorValueDto {
    return {
      id: value.id,
      value: value.value,
      year: value.year,
      periodMonth: value.periodMonth,
      measuredAt: value.measuredAt.toISOString(),
      comment: value.comment,
      recordedById: value.recordedById,
      recordedByName: fullName(value.recordedBy ?? null),
      createdAt: value.createdAt.toISOString(),
      updatedAt: value.updatedAt.toISOString(),
    };
  }

  private toDto(row: IndicatorRow): IndicatorDto {
    const latestRaw = row.values[0] ?? null;
    const latestValue = latestRaw ? this.toValueDto(latestRaw) : null;
    const status: IndicatorEvaluationStatus = evaluateIndicator({
      direction: row.direction,
      value: latestValue?.value ?? null,
      target: row.target,
      warningThreshold: row.warningThreshold,
      criticalThreshold: row.criticalThreshold,
    });
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      departmentId: row.departmentId,
      departmentName: row.department.name,
      category: row.category,
      unit: row.unit,
      direction: row.direction,
      target: row.target,
      warningThreshold: row.warningThreshold,
      criticalThreshold: row.criticalThreshold,
      frequency: row.frequency,
      responsibleUserId: row.responsibleUserId,
      responsibleName: fullName(row.responsible),
      active: row.active,
      createdById: row.createdById,
      createdByName: fullName(row.createdBy),
      latestValue,
      status,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async audit(
    actor: ActorContext,
    action: string,
    entityId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.auditLog.record({
      actorId: actor.actorId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      action,
      entityType: 'indicator',
      entityId,
      metadata: metadata ?? null,
    });
  }
}
