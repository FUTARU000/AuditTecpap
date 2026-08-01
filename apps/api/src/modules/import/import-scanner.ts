import { Injectable, BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { ImportSource } from '@prisma/client';
import { EXTENSION_FORMAT } from '@tecpap/config';
import type { ImportSourceProvider, ScannedFile } from './interfaces/import-provider.interface';
import { LocalFolderProvider } from './providers/local-folder.provider';
import { GoogleDriveProvider } from './providers/google-drive.provider';

/** Returns the import format for an extension, or undefined when unsupported. */
export function formatOf(ext: string): string | undefined {
  return EXTENSION_FORMAT[ext.toLowerCase()];
}

export function checksum(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

/**
 * Resolves the active source provider and enumerates files. Uploads bypass the
 * scanner (their buffers are already in memory); LOCAL/GOOGLE_DRIVE go through it.
 */
@Injectable()
export class ImportScanner {
  private readonly providers: ImportSourceProvider[];
  constructor(local: LocalFolderProvider, drive: GoogleDriveProvider) {
    this.providers = [local, drive];
  }

  providerFor(source: ImportSource): ImportSourceProvider {
    const provider = this.providers.find((p) => p.canHandle(source));
    if (!provider) throw new BadRequestException(`No import provider for source "${source}"`);
    return provider;
  }

  async scan(source: ImportSource, location: string): Promise<ScannedFile[]> {
    const files = await this.providerFor(source).scan(location);
    if (files.length === 0) throw new BadRequestException(`No supported files found in "${location}"`);
    return files;
  }
}

