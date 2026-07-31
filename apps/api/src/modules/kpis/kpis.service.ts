import { Injectable, NotFoundException } from '@nestjs/common';
import type { KpiDto, PaginatedResult } from '@tecpap/types';
import type { Prisma } from '@prisma/client';
import type { ActorContext } from '../../common/context/actor';
import { paginated, parsePagination, parseSort } from '../../common/pagination/pagination';
import { departmentScopeWhere } from '../../common/scoping/scope';
import type { DataScope } from '../../common/types/data-scope';
import { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateKpiDto, ListKpisQuery, RecordKpiValueDto, UpdateKpiDto } from './dto/kpis.dto';

const INCLUDE = {
  responsible: { select: { id: true, firstName: true, lastName: true } },
  department: { select: { id: true, name: true } },
  process: { select: { id: true, name: true } },
} satisfies Prisma.KpiInclude;

@Injectable()
export class KpisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly timeline: ActivityTimelineService,
  ) {}

  async list(query: ListKpisQuery, scope: DataScope | undefined): Promise<PaginatedResult<KpiDto>> {
    const { skip, take, page, pageSize, sort, search } = parsePagination(query);
    const base: Prisma.KpiWhereInput = {
      ...(query.processId ? { processId: query.processId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    };
    const where = departmentScopeWhere(scope, { ...base, ...(query.departmentId ? { departmentId: query.departmentId } : {}) }) as Prisma.KpiWhereInput;
    const [rows, total] = await Promise.all([
      this.prisma.kpi.findMany({ where, skip, take, orderBy: parseSort(sort, ['name', 'createdAt'], { createdAt: 'desc' }), include: INCLUDE }),
      this.prisma.kpi.count({ where }),
    ]);
    return paginated(rows.map((row) => this.toDto(row)), total, page, pageSize);
  }

  async findOne(id: string): Promise<KpiDto> {
    const kpi = await this.prisma.kpi.findUnique({ where: { id }, include: INCLUDE });
    if (!kpi) throw new NotFoundException('KPI not found');
    return this.toDto(kpi);
  }

  async create(dto: CreateKpiDto, actor: ActorContext): Promise<KpiDto> {
    const kpi = await this.prisma.kpi.create({
      data: {
        name: dto.name, description: dto.description ?? null, formula: dto.formula ?? null, unit: dto.unit ?? null,
        target: dto.target ?? null, warningThreshold: dto.warningThreshold ?? null, criticalThreshold: dto.criticalThreshold ?? null,
        currentValue: dto.currentValue ?? null, trend: dto.trend ?? null, frequency: dto.frequency ?? 'MONTHLY', status: dto.status ?? 'ACTIVE',
        responsibleUserId: dto.responsibleUserId ?? null, departmentId: dto.departmentId ?? null, processId: dto.processId ?? null,
      },
      include: INCLUDE,
    });
    await this.timeline.record({ processId: dto.processId, eventType: 'kpi.created', title: `KPI ${kpi.name} defined`, entityType: 'kpi', entityId: kpi.id, actorId: actor.actorId });
    await this.audit(actor, 'kpi.create', kpi.id, { name: kpi.name });
    return this.toDto(kpi);
  }

  async update(id: string, dto: UpdateKpiDto, actor: ActorContext): Promise<KpiDto> {
    const data: Prisma.KpiUncheckedUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.formula !== undefined) data.formula = dto.formula;
    if (dto.unit !== undefined) data.unit = dto.unit;
    if (dto.target !== undefined) data.target = dto.target;
    if (dto.warningThreshold !== undefined) data.warningThreshold = dto.warningThreshold;
    if (dto.criticalThreshold !== undefined) data.criticalThreshold = dto.criticalThreshold;
    if (dto.frequency !== undefined) data.frequency = dto.frequency;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.responsibleUserId !== undefined) data.responsibleUserId = dto.responsibleUserId;
    if (dto.departmentId !== undefined) data.departmentId = dto.departmentId;
    if (dto.processId !== undefined) data.processId = dto.processId;
    const updated = await this.prisma.kpi.update({ where: { id }, data, include: INCLUDE });
    await this.timeline.record({ processId: updated.processId, eventType: 'kpi.updated', title: `KPI ${updated.name} updated`, entityType: 'kpi', entityId: id, actorId: actor.actorId });
    await this.audit(actor, 'kpi.update', id);
    return this.toDto(updated);
  }

  /** Record a measurement — the hook future data sources (ERP/IoT) will call. */
  async recordValue(id: string, dto: RecordKpiValueDto, actor: ActorContext): Promise<KpiDto> {
    const kpi = await this.prisma.kpi.update({ where: { id }, data: { currentValue: dto.currentValue, trend: dto.trend ?? null }, include: INCLUDE });
    await this.timeline.record({ processId: kpi.processId, eventType: 'kpi.value', title: `${kpi.name} = ${dto.currentValue}${kpi.unit ?? ''}`, entityType: 'kpi', entityId: id, actorId: actor.actorId });
    await this.audit(actor, 'kpi.record_value', id, { value: dto.currentValue });
    return this.toDto(kpi);
  }

  async remove(id: string, actor: ActorContext): Promise<void> {
    await this.prisma.kpi.findUnique({ where: { id } }).then((kpi) => { if (!kpi) throw new NotFoundException('KPI not found'); });
    await this.prisma.kpi.delete({ where: { id } });
    await this.audit(actor, 'kpi.delete', id);
  }

  private toDto(kpi: {
    id: string; name: string; description: string | null; formula: string | null; unit: string | null;
    target: number | null; warningThreshold: number | null; criticalThreshold: number | null; currentValue: number | null; trend: string | null;
    frequency: string; status: string; responsibleUserId: string | null; departmentId: string | null; processId: string | null; createdAt: Date; updatedAt: Date;
    responsible: { firstName: string; lastName: string } | null; department: { name: string } | null; process: { name: string } | null;
  }): KpiDto {
    return {
      id: kpi.id, name: kpi.name, description: kpi.description, formula: kpi.formula, unit: kpi.unit,
      target: kpi.target, warningThreshold: kpi.warningThreshold, criticalThreshold: kpi.criticalThreshold, currentValue: kpi.currentValue, trend: kpi.trend,
      frequency: kpi.frequency, status: kpi.status, responsibleUserId: kpi.responsibleUserId, responsibleName: kpi.responsible ? `${kpi.responsible.firstName} ${kpi.responsible.lastName}` : null,
      departmentId: kpi.departmentId, departmentName: kpi.department?.name ?? null, processId: kpi.processId, processName: kpi.process?.name ?? null,
      createdAt: kpi.createdAt.toISOString(), updatedAt: kpi.updatedAt.toISOString(),
    };
  }

  private async audit(actor: ActorContext, action: string, entityId: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.auditLog.record({ actorId: actor.actorId, ipAddress: actor.ipAddress, userAgent: actor.userAgent, action, entityType: 'kpi', entityId, metadata: metadata ?? null });
  }
}
