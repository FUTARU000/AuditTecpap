import { NotFoundException } from '@nestjs/common';
import type { DataScope } from '../../common/types/data-scope';
import { PrismaService } from '../prisma/prisma.service';

/** Load a controlled document and enforce department data-scoping (404 when out of scope). */
export async function loadScopedDocument(
  prisma: PrismaService,
  id: string,
  scope: DataScope | undefined,
): Promise<{ id: string; title: string; code: string; departmentId: string; processId: string | null; currentVersionId: string | null }> {
  const doc = await prisma.controlledDocument.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, title: true, code: true, departmentId: true, processId: true, currentVersionId: true },
  });
  if (!doc) throw new NotFoundException('Document not found');
  if (scope && !scope.isGlobal && doc.departmentId !== scope.departmentId) {
    throw new NotFoundException('Document not found');
  }
  return doc;
}

export function fullName(u: { firstName: string; lastName: string } | null): string {
  return u ? `${u.firstName} ${u.lastName}` : 'Unknown';
}
