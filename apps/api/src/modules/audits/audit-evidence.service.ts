import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MAX_UPLOAD_BYTES, SUPPORTED_FILE_TYPES } from '@tecpap/config';
import type { AuditEvidenceDto } from '@tecpap/types';
import { createHash, randomUUID } from 'crypto';
import type { ActorContext } from '../../common/context/actor';
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

  async listByAudit(auditId: string): Promise<AuditEvidenceDto[]> {
    const rows = await this.prisma.auditEvidence.findMany({ where: { auditId }, orderBy: { createdAt: 'desc' }, include: INCLUDE });
    return rows.map((row) => this.toDto(row));
  }

  async upload(
    auditId: string,
    file: { originalname: string; buffer: Buffer; mimetype: string; size: number },
    meta: { questionId?: string; findingId?: string; comment?: string },
    actor: ActorContext,
  ): Promise<AuditEvidenceDto> {
    const audit = await this.prisma.audit.findUnique({ where: { id: auditId } });
    if (!audit) throw new NotFoundException('Audit not found');
    const extension = file.originalname.split('.').pop()?.toLowerCase() ?? '';
    if (!SUPPORTED_FILE_TYPES[extension]) throw new BadRequestException(`Unsupported file type: .${extension}`);
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

  async downloadUrl(evidenceId: string): Promise<{ url: string }> {
    const evidence = await this.prisma.auditEvidence.findUnique({ where: { id: evidenceId } });
    if (!evidence) throw new NotFoundException('Evidence not found');
    return { url: await this.storage.presignedDownloadUrl(evidence.fileKey) };
  }

  private toDto(row: { id: string; auditId: string | null; questionId: string | null; findingId: string | null; fileName: string; mimeType: string; sizeBytes: number; comment: string | null; uploadedById: string; createdAt: Date; uploadedBy: { firstName: string; lastName: string } | null; }): AuditEvidenceDto {
    return {
      id: row.id, auditId: row.auditId, questionId: row.questionId, findingId: row.findingId, fileName: row.fileName, mimeType: row.mimeType, sizeBytes: row.sizeBytes, comment: row.comment, uploadedById: row.uploadedById, uploadedByName: row.uploadedBy ? `${row.uploadedBy.firstName} ${row.uploadedBy.lastName}` : null, createdAt: row.createdAt.toISOString(),
    };
  }
}
