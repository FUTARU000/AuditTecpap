import type { Prisma } from '@prisma/client';
import type { DocumentDto, DocumentFileSummary } from '@tecpap/types';

/** Shared include used wherever a full document (with relations) is read. */
export const DOC_INCLUDE = {
  department: { select: { id: true, name: true } },
  process: { select: { id: true, name: true } },
  category: { select: { id: true, name: true, color: true } },
  owner: { select: { id: true, firstName: true, lastName: true } },
  reviewer: { select: { id: true, firstName: true, lastName: true } },
  approver: { select: { id: true, firstName: true, lastName: true } },
  currentVersion: {
    select: { id: true, fileName: true, mimeType: true, sizeBytes: true, version: true, createdAt: true },
  },
} satisfies Prisma.ControlledDocumentInclude;

export type DocumentWithRelations = Prisma.ControlledDocumentGetPayload<{ include: typeof DOC_INCLUDE }>;

function fullName(user: { firstName: string; lastName: string } | null): string | null {
  return user ? `${user.firstName} ${user.lastName}` : null;
}

export function toDocumentDto(doc: DocumentWithRelations): DocumentDto {
  const file: DocumentFileSummary | null = doc.currentVersion
    ? {
        versionId: doc.currentVersion.id,
        fileName: doc.currentVersion.fileName,
        mimeType: doc.currentVersion.mimeType,
        sizeBytes: doc.currentVersion.sizeBytes,
        version: doc.currentVersion.version,
        uploadedAt: doc.currentVersion.createdAt.toISOString(),
      }
    : null;

  return {
    id: doc.id,
    title: doc.title,
    code: doc.code,
    description: doc.description,
    departmentId: doc.departmentId,
    departmentName: doc.department.name,
    processId: doc.processId,
    processName: doc.process?.name ?? null,
    categoryId: doc.categoryId,
    categoryName: doc.category.name,
    categoryColor: doc.category.color,
    version: doc.version,
    revision: doc.revision,
    status: doc.status,
    ownerId: doc.ownerId,
    ownerName: fullName(doc.owner),
    reviewerId: doc.reviewerId,
    reviewerName: fullName(doc.reviewer),
    approverId: doc.approverId,
    approverName: fullName(doc.approver),
    keywords: doc.keywords,
    confidentiality: doc.confidentiality,
    effectiveDate: doc.effectiveDate ? doc.effectiveDate.toISOString() : null,
    reviewDate: doc.reviewDate ? doc.reviewDate.toISOString() : null,
    expirationDate: doc.expirationDate ? doc.expirationDate.toISOString() : null,
    createdById: doc.createdById,
    updatedById: doc.updatedById,
    file,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
