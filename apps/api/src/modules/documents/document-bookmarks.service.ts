import { Injectable, NotFoundException } from '@nestjs/common';
import type { DocumentBookmarkDto } from '@tecpap/types';
import { PrismaService } from '../prisma/prisma.service';

/** Document bookmarks — documents, versions, searches, collections. */
@Injectable()
export class DocumentBookmarksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<DocumentBookmarkDto[]> {
    const rows = await this.prisma.documentBookmark.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    return rows.map((b) => ({ id: b.id, type: b.type as DocumentBookmarkDto['type'], entityId: b.entityId, versionId: b.versionId, label: b.label, href: b.href, createdAt: b.createdAt.toISOString() }));
  }

  async add(userId: string, input: { type: 'document' | 'version' | 'search' | 'collection'; entityId: string; versionId?: string; label: string; href: string }): Promise<DocumentBookmarkDto> {
    const row = await this.prisma.documentBookmark.upsert({
      where: { userId_type_entityId: { userId, type: input.type, entityId: input.entityId } },
      update: { label: input.label, href: input.href, versionId: input.versionId ?? null },
      create: { userId, ...input, versionId: input.versionId ?? null },
    });
    return { id: row.id, type: row.type as DocumentBookmarkDto['type'], entityId: row.entityId, versionId: row.versionId, label: row.label, href: row.href, createdAt: row.createdAt.toISOString() };
  }

  async remove(userId: string, id: string): Promise<void> {
    const b = await this.prisma.documentBookmark.findUnique({ where: { id }, select: { userId: true } });
    if (!b || b.userId !== userId) throw new NotFoundException('Bookmark not found');
    await this.prisma.documentBookmark.delete({ where: { id } });
  }
}
