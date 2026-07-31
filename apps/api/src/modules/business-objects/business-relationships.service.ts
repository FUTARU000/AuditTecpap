import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { BusinessRelationshipDto } from '@tecpap/types';
import type { ActorContext } from '../../common/context/actor';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateRelationshipDto } from './dto/business-objects.dto';

/**
 * Generic relationship engine: links ANY entity to ANY entity
 * (document ↔ risk ↔ audit ↔ finding; supplier → order → production → customer).
 * Polymorphic by (entityType, entityId).
 */
@Injectable()
export class BusinessRelationshipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(sourceType: string, sourceId: string): Promise<BusinessRelationshipDto[]> {
    const rows = await this.prisma.businessRelationship.findMany({
      where: { sourceType, sourceId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({
      id: row.id, sourceType: row.sourceType, sourceId: row.sourceId, targetType: row.targetType, targetId: row.targetId, type: row.type, label: row.label, createdAt: row.createdAt.toISOString(),
    }));
  }

  async create(dto: CreateRelationshipDto, actor: ActorContext): Promise<BusinessRelationshipDto> {
    const relation = await this.prisma.businessRelationship
      .create({ data: { sourceType: dto.sourceType, sourceId: dto.sourceId, targetType: dto.targetType, targetId: dto.targetId, type: dto.type, label: dto.label ?? null } })
      .catch(() => { throw new ConflictException('This relationship already exists'); });
    await this.auditLog.record({ actorId: actor.actorId, ipAddress: actor.ipAddress, userAgent: actor.userAgent, action: 'relationship.create', entityType: dto.sourceType, entityId: dto.sourceId, metadata: { targetType: dto.targetType, targetId: dto.targetId, type: dto.type } });
    return { id: relation.id, sourceType: relation.sourceType, sourceId: relation.sourceId, targetType: relation.targetType, targetId: relation.targetId, type: relation.type, label: relation.label, createdAt: relation.createdAt.toISOString() };
  }

  async remove(id: string, actor: ActorContext): Promise<void> {
    const relation = await this.prisma.businessRelationship.findUnique({ where: { id } });
    if (!relation) throw new NotFoundException('Relationship not found');
    await this.prisma.businessRelationship.delete({ where: { id } });
    await this.auditLog.record({ actorId: actor.actorId, ipAddress: actor.ipAddress, userAgent: actor.userAgent, action: 'relationship.delete', entityType: relation.sourceType, entityId: relation.sourceId, metadata: { relationId: id } });
  }
}
