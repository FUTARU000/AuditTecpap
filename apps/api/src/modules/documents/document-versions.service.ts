import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BLOCKED_FILE_EXTENSIONS, MAX_UPLOAD_BYTES, SUPPORTED_EXTENSIONS_LIST, SUPPORTED_FILE_TYPES } from '@tecpap/config';
import { AUDIT_ACTIONS, type DocumentVersionDto } from '@tecpap/types';
import { createHash, randomUUID } from 'crypto';
import type { ActorContext } from '../../common/context/actor';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import type { CreateVersionDto } from './dto/documents.dto';

const VERSION_INCLUDE = {
  uploadedBy: { select: { id: true, firstName: true, lastName: true } },
  approvedBy: { select: { id: true, firstName: true, lastName: true } },
} as const;

@Injectable()
export class DocumentVersionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(documentId: string): Promise<DocumentVersionDto[]> {
    const document = await this.prisma.controlledDocument.findUnique({ where: { id: documentId }, select: { currentVersionId: true } });
    if (!document) {
      throw new NotFoundException('Document not found');
    }
    const versions = await this.prisma.documentVersion.findMany({
      where: { documentId },
      orderBy: { revision: 'desc' },
      include: VERSION_INCLUDE,
    });
    return versions.map((version) => this.toDto(version, document.currentVersionId));
  }

  /** Upload a file as a new immutable version. Previous versions are never modified. */
  async create(
    documentId: string,
    file: { originalname: string; buffer: Buffer; mimetype: string; size: number },
    dto: CreateVersionDto,
    actor: ActorContext,
  ): Promise<DocumentVersionDto> {
    const document = await this.prisma.controlledDocument.findFirst({ where: { id: documentId, deletedAt: null } });
    if (!document) {
      throw new NotFoundException('Document not found');
    }
    if (!actor.actorId) {
      throw new BadRequestException('Authenticated actor required');
    }

    const extension = file.originalname.split('.').pop()?.toLowerCase() ?? '';
    if (BLOCKED_FILE_EXTENSIONS.has(extension)) {
      throw new BadRequestException(`File type ".${extension}" is blocked for security reasons.`);
    }
    if (!SUPPORTED_FILE_TYPES[extension]) {
      throw new BadRequestException(
        `File type ".${extension}" is not supported. Allowed types: ${SUPPORTED_EXTENSIONS_LIST}.`,
      );
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new BadRequestException(`File exceeds the ${MAX_UPLOAD_BYTES / (1024 * 1024)} MiB limit`);
    }

    const latest = await this.prisma.documentVersion.findFirst({
      where: { documentId },
      orderBy: { revision: 'desc' },
    });
    const revision = (latest?.revision ?? 0) + 1;
    const fileKey = `${documentId}/${revision}-${randomUUID()}/${file.originalname}`;
    const checksum = createHash('sha256').update(file.buffer).digest('hex');

    await this.storage.putObject(fileKey, file.buffer, file.mimetype);

    const version = await this.prisma.$transaction(async (tx) => {
      const created = await tx.documentVersion.create({
        data: {
          documentId,
          version: dto.version,
          revision,
          fileKey,
          fileName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          checksum,
          comment: dto.comment ?? null,
          uploadedById: actor.actorId!,
        },
        include: VERSION_INCLUDE,
      });
      // Promote to the active version + bump the document's revision counter.
      await tx.controlledDocument.update({
        where: { id: documentId },
        data: {
          currentVersionId: created.id,
          version: dto.version,
          revision,
          updatedById: actor.actorId,
        },
      });
      return created;
    });

    await this.auditLog.record({
      actorId: actor.actorId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      action: AUDIT_ACTIONS.DOCUMENT_VERSION_UPLOAD,
      entityType: 'document',
      entityId: documentId,
      metadata: { version: dto.version, revision },
    });
    return this.toDto(version, version.id);
  }

  async approve(documentId: string, versionId: string, actor: ActorContext): Promise<DocumentVersionDto> {
    const version = await this.prisma.documentVersion.findFirst({
      where: { id: versionId, documentId },
      include: VERSION_INCLUDE,
    });
    if (!version) {
      throw new NotFoundException('Version not found');
    }
    const updated = await this.prisma.documentVersion.update({
      where: { id: versionId },
      data: { approvedById: actor.actorId, approvedAt: new Date() },
      include: VERSION_INCLUDE,
    });
    await this.prisma.controlledDocument.update({
      where: { id: documentId },
      data: { currentVersionId: versionId, updatedById: actor.actorId },
    });
    await this.auditLog.record({
      actorId: actor.actorId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      action: AUDIT_ACTIONS.DOCUMENT_VERSION_APPROVE,
      entityType: 'document',
      entityId: documentId,
      metadata: { versionId },
    });
    return this.toDto(updated, versionId);
  }

  async downloadUrl(documentId: string, versionId: string): Promise<{ url: string }> {
    const version = await this.prisma.documentVersion.findFirst({ where: { id: versionId, documentId } });
    if (!version) {
      throw new NotFoundException('Version not found');
    }
    const url = await this.storage.presignedDownloadUrl(version.fileKey);
    return { url };
  }

  private toDto(
    version: {
      id: string;
      documentId: string;
      version: string;
      revision: number;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      checksum: string | null;
      comment: string | null;
      uploadedById: string;
      uploadedBy: { firstName: string; lastName: string } | null;
      approvedById: string | null;
      approvedBy: { firstName: string; lastName: string } | null;
      approvedAt: Date | null;
      createdAt: Date;
    },
    currentVersionId: string | null,
  ): DocumentVersionDto {
    return {
      id: version.id,
      documentId: version.documentId,
      version: version.version,
      revision: version.revision,
      fileName: version.fileName,
      mimeType: version.mimeType,
      sizeBytes: version.sizeBytes,
      checksum: version.checksum,
      comment: version.comment,
      uploadedById: version.uploadedById,
      uploadedByName: version.uploadedBy ? `${version.uploadedBy.firstName} ${version.uploadedBy.lastName}` : null,
      approvedById: version.approvedById,
      approvedByName: version.approvedBy ? `${version.approvedBy.firstName} ${version.approvedBy.lastName}` : null,
      approvedAt: version.approvedAt ? version.approvedAt.toISOString() : null,
      isActive: version.id === currentVersionId,
      createdAt: version.createdAt.toISOString(),
    };
  }
}
