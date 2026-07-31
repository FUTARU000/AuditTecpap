import { Injectable } from '@nestjs/common';
import type { ActivityTimelineDto } from '@tecpap/types';
import { PrismaService } from '../prisma/prisma.service';

export interface TimelineInput {
  processId?: string | null;
  eventType: string;
  title: string;
  entityType: string;
  entityId?: string | null;
  actorId?: string | null;
}

/**
 * Process-scoped activity feed. Global so any domain service (KPIs, risks,
 * business objects, …) records events without circular dependencies.
 */
@Injectable()
export class ActivityTimelineService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: TimelineInput): Promise<void> {
    await this.prisma.activityTimeline.create({
      data: {
        processId: input.processId ?? null,
        eventType: input.eventType,
        title: input.title,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        actorId: input.actorId ?? null,
      },
    });
  }

  async listByProcess(processId: string, limit = 25): Promise<ActivityTimelineDto[]> {
    const rows = await this.prisma.activityTimeline.findMany({
      where: { processId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { actor: { select: { firstName: true, lastName: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      processId: row.processId,
      eventType: row.eventType,
      title: row.title,
      entityType: row.entityType,
      entityId: row.entityId,
      actorName: row.actor ? `${row.actor.firstName} ${row.actor.lastName}` : null,
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
