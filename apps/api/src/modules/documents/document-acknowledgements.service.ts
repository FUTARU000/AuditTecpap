import { BadRequestException, Injectable } from '@nestjs/common';
import type { AcknowledgementStatusDto, DocumentAcknowledgementDto } from '@tecpap/types';
import type { ActorContext } from '../../common/context/actor';
import type { DataScope } from '../../common/types/data-scope';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import { loadScopedDocument, fullName } from './document-experience.util';

/** Read acknowledgements — department-scoped "who has / has not read" per version. */
@Injectable()
export class DocumentAcknowledgementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timeline: ActivityTimelineService,
  ) {}

  async acknowledge(documentId: string, actor: ActorContext, scope: DataScope | undefined): Promise<DocumentAcknowledgementDto> {
    const doc = await loadScopedDocument(this.prisma, documentId, scope);
    if (!doc.currentVersionId) throw new BadRequestException('Document has no current version to acknowledge');
    const user = await this.prisma.user.findUnique({ where: { id: actor.actorId! }, select: { departmentId: true } });
    const ack = await this.prisma.documentAcknowledgement.upsert({
      where: { documentId_versionId_userId: { documentId, versionId: doc.currentVersionId, userId: actor.actorId! } },
      update: { acknowledgedAt: new Date() },
      create: { documentId, versionId: doc.currentVersionId, userId: actor.actorId!, departmentId: user?.departmentId ?? null, acknowledgedAt: new Date() },
      include: { user: { select: { firstName: true, lastName: true } } },
    });
    await this.timeline.record({ processId: doc.processId, eventType: 'document.acknowledged', title: `${doc.code} acknowledged`, entityType: 'document', entityId: documentId, actorId: actor.actorId });
    return { id: ack.id, documentId: ack.documentId, versionId: ack.versionId, userId: ack.userId, userName: fullName(ack.user), departmentId: ack.departmentId, acknowledgedAt: ack.acknowledgedAt.toISOString() };
  }

  async status(documentId: string, scope: DataScope | undefined): Promise<AcknowledgementStatusDto> {
    const doc = await loadScopedDocument(this.prisma, documentId, scope);
    if (!doc.currentVersionId) throw new BadRequestException('Document has no current version');
    const versionId = doc.currentVersionId;
    const [acks, members] = await Promise.all([
      this.prisma.documentAcknowledgement.findMany({ where: { documentId, versionId }, include: { user: { select: { firstName: true, lastName: true } } } }),
      this.prisma.user.findMany({ where: { departmentId: doc.departmentId, status: 'ACTIVE', deletedAt: null }, select: { id: true, firstName: true, lastName: true } }),
    ]);
    const ackedIds = new Set(acks.map((a) => a.userId));
    return {
      documentId, versionId,
      acknowledged: acks.map((a) => ({ userId: a.userId, userName: fullName(a.user), acknowledgedAt: a.acknowledgedAt.toISOString() })),
      pending: members.filter((m) => !ackedIds.has(m.id)).map((m) => ({ userId: m.id, userName: fullName(m) })),
    };
  }
}
