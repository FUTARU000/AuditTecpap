import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BLOCKED_FILE_EXTENSIONS, MAX_UPLOAD_BYTES, SUPPORTED_EXTENSIONS_LIST, SUPPORTED_FILE_TYPES } from '@tecpap/config';
import type { AuditEvidenceDto } from '@tecpap/types';
import type { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import type { ActorContext } from '../../common/context/actor';
import { departmentScopeWhere } from '../../common/scoping/scope';
import type { DataScope } from '../../common/types/data-scope';
import { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

const INCLUDE = { uploadedBy: { select: { firstName: true, lastName: true } } };

@Injectable()
export class AuditEvidenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly timeline: ActivityTimelineService,
  ) {}

  async listByAudit(auditId: string, scope: DataScope | undefined): Promise<AuditEvidenceDto[]> {
    await this.assertAuditInScope(auditId, scope);
    const rows = await this.prisma.auditEvidence.findMany({ where: { auditId }, orderBy: { createdAt: 'desc' }, include: INCLUDE });
    return rows.map((row) => this.toDto(row));
  }

  async upload(
    auditId: string,
    file: { originalname: string; buffer: Buffer; mimetype: string; size: number },
    meta: { questionId?: string; findingId?: string; comment?: string },
    actor: ActorContext,
    scope: DataScope | undefined,
  ): Promise<AuditEvidenceDto> {
    const audit = await this.assertAuditInScope(auditId, scope);
    const extension = file.originalname.split('.').pop()?.toLowerCase() ?? '';
    if (BLOCKED_FILE_EXTENSIONS.has(extension)) throw new BadRequestException(`File type ".${extension}" is blocked for security reasons.`);
    if (!SUPPORTED_FILE_TYPES[extension]) throw new BadRequestException(`File type ".${extension}" is not supported. Allowed types: ${SUPPORTED_EXTENSIONS_LIST}.`);
    if (file.size > MAX_UPLOAD_BYTES) throw new BadRequestException('File too large');

    const fileKey = `audits/${auditId}/${randomUUID()}/${file.originalname}`;
    await this.storage.putObject(fileKey, file.buffer, file.mimetype);
    const checksum = createHash('sha256').update(file.buffer).digest('hex');

    const evidence = await this.prisma.auditEvidence.create({
      data: { auditId, questionId: meta.questionId ?? null, findingId: meta.findingId ?? null, fileKey, fileName: file.originalname, mimeType: file.mimetype, sizeBytes: file.size, comment: meta.comment ?? null, uploadedById: actor.actorId ?? '' },
      include: INCLUDE,
    });
    await this.timeline.record({ processId: audit.processId, eventType: 'evidence.uploaded', title: `Evidence uploaded: ${file.originalname}`, entityType: 'evidence', entityId: evidence.id, actorId: actor.actorId });
    return this.toDto(evidence);
  }

  async downloadUrl(evidenceId: string, scope: DataScope | undefined): Promise<{ url: string }> {
    const evidence = await this.prisma.auditEvidence.findUnique({ where: { id: evidenceId } });
    if (!evidence) throw new NotFoundException('Evidence not found');
    await this.assertEvidenceAuditInScope(evidence.auditId, scope);
    return { url: await this.storage.presignedDownloadUrl(evidence.fileKey) };
  }

  async remove(evidenceId: string, actor: ActorContext, scope: DataScope | undefined): Promise<void> {
    const evidence = await this.prisma.auditEvidence.findUnique({ where: { id: evidenceId } });
    if (!evidence) throw new NotFoundException('Evidence not found');
    await this.assertEvidenceAuditInScope(evidence.auditId, scope);
    await this.storage.deleteObject(evidence.fileKey).catch(() => undefined);
    await this.prisma.auditEvidence.delete({ where: { id: evidenceId } });
    await this.timeline.record({ processId: null, eventType: 'evidence.deleted', title: `Evidence deleted: ${evidence.fileName}`, entityType: 'evidence', entityId: evidenceId, actorId: actor.actorId });
  }

  /** Resolves the audit within `scope`, throwing NotFound if it doesn't exist or belongs to another department. */
  private async assertAuditInScope(auditId: string, scope: DataScope | undefined) {
    const audit = await this.prisma.audit.findFirst({ where: departmentScopeWhere(scope, { id: auditId }) as Prisma.AuditWhereInput });
    if (!audit) throw new NotFoundException('Audit not found');
    return audit;
  }

  /** Evidence has no departmentId of its own — scope is derived from its parent audit. Fails closed if the audit link is missing. */
  private async assertEvidenceAuditInScope(auditId: string | null, scope: DataScope | undefined): Promise<void> {
    if (!scope || scope.isGlobal) return;
    if (!auditId) throw new NotFoundException('Evidence not found');
    const audit = await this.prisma.audit.findFirst({ where: departmentScopeWhere(scope, { id: auditId }) as Prisma.AuditWhereInput });
    if (!audit) throw new NotFoundException('Evidence not found');
  }

  private toDto(row: { id: string; auditId: string | null; questionId: string | null; findingId: string | null; fileName: string; mimeType: string; sizeBytes: number; comment: string | null; uploadedById: string; createdAt: Date; uploadedBy: { firstName: string; lastName: string } | null; }): AuditEvidenceDto {
    return {
      id: row.id, auditId: row.auditId, questionId: row.questionId, findingId: row.findingId, fileName: row.fileName, mimeType: row.mimeType, sizeBytes: row.sizeBytes, comment: row.comment, uploadedById: row.uploadedById, uploadedByName: row.uploadedBy ? `${row.uploadedBy.firstName} ${row.uploadedBy.lastName}` : null, createdAt: row.createdAt.toISOString(),
    };
  }
}
