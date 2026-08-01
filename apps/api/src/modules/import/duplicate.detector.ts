import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface DuplicationResult {
  /** A previously-imported file with the exact same checksum (true duplicate). */
  checksumDuplicateDocId: string | null;
  /** An existing controlled document sharing the same code (version conflict). */
  codeConflictDocId: string | null;
}

/**
 * Duplicate + version detection.
 *  • Checksum match → the very same file already exists → Skip/Replace/Merge/Keep.
 *  • Code match → a new revision of a known document → New version/Replace draft/Merge.
 * Published versions stay immutable; only drafts may be replaced.
 */
@Injectable()
export class DuplicateDetector {
  constructor(private readonly prisma: PrismaService) {}

  async detect(checksum: string | null, code: string | null): Promise<DuplicationResult> {
    const [checksumDuplicateDocId, codeConflictDocId] = await Promise.all([
      checksum
        ? this.prisma.documentVersion
            .findFirst({ where: { checksum }, select: { documentId: true } })
            .then((v) => v?.documentId ?? null)
        : Promise.resolve(null),
      code
        ? this.prisma.controlledDocument
            .findFirst({ where: { code, deletedAt: null }, select: { id: true } })
            .then((d) => d?.id ?? null)
        : Promise.resolve(null),
    ]);
    return { checksumDuplicateDocId, codeConflictDocId };
  }
}
