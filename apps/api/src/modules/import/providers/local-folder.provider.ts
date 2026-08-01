import { Injectable } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { EXTENSION_FORMAT, SUPPORTED_FILE_TYPES } from '@tecpap/config';
import type { ImportSourceProvider, ScannedFile } from '../interfaces/import-provider.interface';

/**
 * Scans a locally-mounted folder (the typical "Google Drive export" landing
 * zone) recursively. Streaming + lazy reads keep thousands of files memory-light:
 * bytes are only loaded when a specific item is parsed.
 */
@Injectable()
export class LocalFolderProvider implements ImportSourceProvider {
  readonly source = 'LOCAL' as const;
  readonly key = 'local';

  canHandle(source: 'LOCAL' | 'GOOGLE_DRIVE' | 'UPLOAD'): boolean {
    return source === 'LOCAL';
  }

  async scan(location: string): Promise<ScannedFile[]> {
    const root = path.resolve(location);
    const stat = await fs.stat(root).catch(() => null);
    if (!stat) throw new Error(`Import source folder not found: ${location}`);
    if (!stat.isDirectory()) throw new Error(`Import source is not a folder: ${location}`);

    const out: ScannedFile[] = [];
    await this.walk(root, root, out);
    return out;
  }

  private async walk(root: string, dir: string, out: ScannedFile[]): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await this.walk(root, full, out);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).slice(1).toLowerCase();
        const format = EXTENSION_FORMAT[ext];
        if (!format) continue; // unsupported — skipped at scan time
        const abs = full;
        const stat = await fs.stat(abs);
        out.push({
          originalPath: path.relative(root, full).split(path.sep).join('/'),
          relativePath: path.relative(root, full).split(path.sep).join('/'),
          fileName: entry.name,
          extension: ext,
          mimeType: SUPPORTED_FILE_TYPES[ext] ?? 'application/octet-stream',
          sizeBytes: stat.size,
          parentFolder: path.relative(root, path.dirname(full)).split(path.sep).join('/') || null,
          modifiedAt: stat.mtime,
          read: () => fs.readFile(abs),
        });
      }
    }
  }
}
