import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AUDIT_ACTIONS, type DocumentRelationDto } from '@tecpap/types';
import type { ActorContext } from '../../common/context/actor';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateRelationDto } from './dto/documents.dto';

const RELATION_TARGET_INCLUDE = {
  targetDocument: { select: { id: true, title: true, code: true, status: true } },
} as const;

@Injectable()
export class DocumentRelationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(documentId: string): Promise<DocumentRelationDto[]> {
    const relations = await this.prisma.documentRelation.findMany({
      where: { sourceDocumentId: documentId },
      include: RELATION_TARGET_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return relations.map((relation) => ({
      id: relation.id,
      sourceDocumentId: relation.sourceDocumentId,
      targetDocumentId: relation.targetDocumentId,
      type: relation.type,
      targetTitle: relation.targetDocument.title,
      targetCode: relation.targetDocument.code,
      targetStatus: relation.targetDocument.status,
      createdAt: relation.createdAt.toISOString(),
    }));
  }

  async add(documentId: string, dto: CreateRelationDto, actor: ActorContext): Promise<DocumentRelationDto> {
    if (dto.targetDocumentId === documentId) {
      throw new BadRequestException('A document cannot reference itself');
    }
    const target = await this.prisma.controlledDocument.findFirst({
      where: { id: dto.targetDocumentId, deletedAt: null },
    });
    if (!target) {
      throw new NotFoundException('Target document not found');
    }

    const relation = await this.prisma.documentRelation
      .create({
        data: { sourceDocumentId: documentId, targetDocumentId: dto.targetDocumentId, type: dto.type },
        include: RELATION_TARGET_INCLUDE,
      })
      .catch(() => {
        throw new ConflictException('This relationship already exists');
      });

    await this.auditLog.record({
      actorId: actor.actorId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      action: AUDIT_ACTIONS.DOCUMENT_RELATION_ADD,
      entityType: 'document',
      entityId: documentId,
      metadata: { targetDocumentId: dto.targetDocumentId, type: dto.type },
    });

    return {
      id: relation.id,
      sourceDocumentId: relation.sourceDocumentId,
      targetDocumentId: relation.targetDocumentId,
      type: relation.type,
      targetTitle: relation.targetDocument.title,
      targetCode: relation.targetDocument.code,
      targetStatus: relation.targetDocument.status,
      createdAt: relation.createdAt.toISOString(),
    };
  }

  async remove(documentId: string, relationId: string, actor: ActorContext): Promise<void> {
    const relation = await this.prisma.documentRelation.findFirst({ where: { id: relationId, sourceDocumentId: documentId } });
    if (!relation) {
      throw new NotFoundException('Relationship not found');
    }
    await this.prisma.documentRelation.delete({ where: { id: relationId } });
    await this.auditLog.record({
      actorId: actor.actorId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      action: AUDIT_ACTIONS.DOCUMENT_RELATION_REMOVE,
      entityType: 'document',
      entityId: documentId,
      metadata: { relationId },
    });
  }
}
