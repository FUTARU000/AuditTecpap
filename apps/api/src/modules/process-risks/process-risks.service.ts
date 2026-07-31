import { Injectable, NotFoundException } from '@nestjs/common';
import type { PaginatedResult, ProcessRiskDto } from '@tecpap/types';
import type { Prisma } from '@prisma/client';
import type { ActorContext } from '../../common/context/actor';
import { paginated, parsePagination, parseSort } from '../../common/pagination/pagination';
import type { DataScope } from '../../common/types/data-scope';
import { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateProcessRiskDto, ListRisksQuery, UpdateProcessRiskDto } from './dto/process-risks.dto';

const INCLUDE = { process: { select: { id: true, name: true, departmentId: true } }, owner: { select: { id: true, firstName: true, lastName: true } } } satisfies Prisma.ProcessRiskInclude;

function riskScore(probability: number, impact: number): number {
  return Math.min(25, Math.max(1, probability)) * Math.min(25, Math.max(1, impact));
}

@Injectable()
export class ProcessRisksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly timeline: ActivityTimelineService,
  ) {}

  async list(query: ListRisksQuery, scope: DataScope | undefined): Promise<PaginatedResult<ProcessRiskDto>> {
    const { skip, take, page, pageSize, sort, search } = parsePagination(query);
    const where: Prisma.ProcessRiskWhereInput = {
      ...(query.processId ? { processId: query.processId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(search ? { title: { contains: search, mode: 'insensitive' } } : {}),
      // Department scoping via the owning process.
      ...(scope && !scope.isGlobal ? { process: { departmentId: scope.departmentId ?? undefined } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.processRisk.findMany({ where, skip, take, orderBy: parseSort(sort, ['title', 'riskScore', 'createdAt'], { riskScore: 'desc' }), include: INCLUDE }),
      this.prisma.processRisk.count({ where }),
    ]);
    return paginated(rows.map((row) => this.toDto(row)), total, page, pageSize);
  }

  async findOne(id: string): Promise<ProcessRiskDto> {
    const risk = await this.prisma.processRisk.findUnique({ where: { id }, include: INCLUDE });
    if (!risk) throw new NotFoundException('Risk not found');
    return this.toDto(risk);
  }

  async create(dto: CreateProcessRiskDto, actor: ActorContext): Promise<ProcessRiskDto> {
    const process = await this.prisma.process.findFirst({ where: { id: dto.processId, deletedAt: null } });
    if (!process) throw new NotFoundException('Process not found');
    const probability = dto.probability ?? 3;
    const impact = dto.impact ?? 3;
    const risk = await this.prisma.processRisk.create({
      data: {
        processId: dto.processId, title: dto.title, description: dto.description ?? null,
        probability, impact, riskScore: riskScore(probability, impact),
        ownerId: dto.ownerId ?? null, mitigation: dto.mitigation ?? null,
        reviewDate: dto.reviewDate ? new Date(dto.reviewDate) : null, status: dto.status ?? 'OPEN',
      },
      include: INCLUDE,
    });
    await this.timeline.record({ processId: dto.processId, eventType: 'risk.created', title: `Risk "${risk.title}" identified`, entityType: 'risk', entityId: risk.id, actorId: actor.actorId });
    await this.audit(actor, 'risk.create', risk.id, { title: risk.title });
    return this.toDto(risk);
  }

  async update(id: string, dto: UpdateProcessRiskDto, actor: ActorContext): Promise<ProcessRiskDto> {
    const current = await this.prisma.processRisk.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Risk not found');
    const probability = dto.probability ?? current.probability;
    const impact = dto.impact ?? current.impact;
    const data: Prisma.ProcessRiskUncheckedUpdateInput = { riskScore: riskScore(probability, impact) };
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.probability !== undefined) data.probability = dto.probability;
    if (dto.impact !== undefined) data.impact = dto.impact;
    if (dto.ownerId !== undefined) data.ownerId = dto.ownerId;
    if (dto.mitigation !== undefined) data.mitigation = dto.mitigation;
    if (dto.reviewDate !== undefined) data.reviewDate = dto.reviewDate ? new Date(dto.reviewDate) : null;
    if (dto.status !== undefined) data.status = dto.status;
    const updated = await this.prisma.processRisk.update({ where: { id }, data, include: INCLUDE });
    await this.timeline.record({ processId: updated.processId, eventType: 'risk.updated', title: `Risk "${updated.title}" updated`, entityType: 'risk', entityId: id, actorId: actor.actorId });
    await this.audit(actor, 'risk.update', id);
    return this.toDto(updated);
  }

  async remove(id: string, actor: ActorContext): Promise<void> {
    const risk = await this.prisma.processRisk.findUnique({ where: { id } });
    if (!risk) throw new NotFoundException('Risk not found');
    await this.prisma.processRisk.delete({ where: { id } });
    await this.audit(actor, 'risk.delete', id);
  }

  private toDto(risk: {
    id: string; processId: string; title: string; description: string | null; probability: number; impact: number; riskScore: number;
    ownerId: string | null; mitigation: string | null; reviewDate: Date | null; status: string; createdAt: Date; updatedAt: Date;
    owner: { firstName: string; lastName: string } | null;
  }): ProcessRiskDto {
    return {
      id: risk.id, processId: risk.processId, title: risk.title, description: risk.description,
      probability: risk.probability, impact: risk.impact, riskScore: risk.riskScore,
      ownerId: risk.ownerId, ownerName: risk.owner ? `${risk.owner.firstName} ${risk.owner.lastName}` : null,
      mitigation: risk.mitigation, reviewDate: risk.reviewDate ? risk.reviewDate.toISOString() : null, status: risk.status,
      createdAt: risk.createdAt.toISOString(), updatedAt: risk.updatedAt.toISOString(),
    };
  }

  private async audit(actor: ActorContext, action: string, entityId: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.auditLog.record({ actorId: actor.actorId, ipAddress: actor.ipAddress, userAgent: actor.userAgent, action, entityType: 'risk', entityId, metadata: metadata ?? null });
  }
}
