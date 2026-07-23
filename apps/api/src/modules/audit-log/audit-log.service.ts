import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuditLogDto, PaginatedResult } from '@tecpap/types';
import { paginated, parsePagination, parseSort } from '../../common/pagination/pagination';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogInput {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  target?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface AuditLogQuery {
  page?: string;
  pageSize?: string;
  search?: string;
  sort?: string;
  action?: string;
  entityType?: string;
  actorId?: string;
}

/**
 * Append-only audit log. By design this service exposes ONLY `record` and `list`
 * — there is no update or delete path anywhere in the application, enforcing
 * immutability (SAD §17.6).
 */
@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditLogInput): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        target: input.target ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });
  }

  async list(query: AuditLogQuery): Promise<PaginatedResult<AuditLogDto>> {
    const { skip, take, page, pageSize, sort } = parsePagination(query);
    const where = {
      ...(query.action ? { action: query.action } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: parseSort(sort, ['createdAt', 'action'], { createdAt: 'desc' }),
        include: {
          actor: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return paginated(
      rows.map((row) => this.toDto(row)),
      total,
      page,
      pageSize,
    );
  }

  private toDto(row: {
    id: string;
    actorId: string | null;
    action: string;
    entityType: string;
    entityId: string | null;
    target: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    metadata: unknown;
    createdAt: Date;
    actor?: { firstName: string; lastName: string; email: string } | null;
  }): AuditLogDto {
    return {
      id: row.id,
      actorId: row.actorId,
      actorName: row.actor ? `${row.actor.firstName} ${row.actor.lastName}` : null,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      target: row.target,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      metadata: (row.metadata as Record<string, unknown> | null) ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
