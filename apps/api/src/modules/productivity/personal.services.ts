import { Injectable, NotFoundException } from '@nestjs/common';
import type { RecentItemDto, ReportSubscriptionDto } from '@tecpap/types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RecentItemsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, limit = 10): Promise<RecentItemDto[]> {
    const rows = await this.prisma.recentItem.findMany({ where: { userId }, orderBy: { viewedAt: 'desc' }, take: limit });
    return rows.map((r) => ({ id: r.id, entityType: r.entityType, entityId: r.entityId, label: r.label, href: r.href, viewedAt: r.viewedAt.toISOString() }));
  }

  async record(userId: string, input: { entityType: string; entityId: string; label: string; href: string }): Promise<void> {
    await this.prisma.recentItem.upsert({
      where: { userId_entityType_entityId: { userId, entityType: input.entityType, entityId: input.entityId } },
      update: { label: input.label, href: input.href, viewedAt: new Date() },
      create: { userId, ...input },
    });
  }
}

@Injectable()
export class SubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<ReportSubscriptionDto[]> {
    const rows = await this.prisma.reportSubscription.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    return rows.map((s) => ({ id: s.id, reportType: s.reportType, frequency: s.frequency as 'DAILY' | 'WEEKLY' | 'MONTHLY', channel: s.channel, active: s.active, createdAt: s.createdAt.toISOString() }));
  }

  async upsert(userId: string, input: { reportType: string; frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY'; channel?: string }): Promise<ReportSubscriptionDto> {
    const row = await this.prisma.reportSubscription.upsert({
      where: { userId_reportType: { userId, reportType: input.reportType } },
      update: { frequency: input.frequency, channel: input.channel ?? 'email', active: true },
      create: { userId, reportType: input.reportType, frequency: input.frequency, channel: input.channel ?? 'email' },
    });
    return { id: row.id, reportType: row.reportType, frequency: row.frequency as 'DAILY' | 'WEEKLY' | 'MONTHLY', channel: row.channel, active: row.active, createdAt: row.createdAt.toISOString() };
  }

  async remove(userId: string, id: string): Promise<void> {
    const s = await this.prisma.reportSubscription.findUnique({ where: { id }, select: { userId: true } });
    if (!s || s.userId !== userId) throw new NotFoundException('Subscription not found');
    await this.prisma.reportSubscription.delete({ where: { id } });
  }
}
