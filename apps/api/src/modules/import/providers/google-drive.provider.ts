import { Injectable, NotImplementedException } from '@nestjs/common';
import type { ImportSourceProvider, ScannedFile } from '../interfaces/import-provider.interface';

/**
 * Google Drive provider — architectural extension point.
 *
 * Wiring the Drive API (OAuth service account, recursive folder traversal via
 * `files.list`, streaming downloads) is intentionally left as the documented
 * integration step. The interface and job flow already support it: implement
 * `scan()` to return ScannedFile[] (with `read()` streaming each file's bytes)
 * and the rest of the pipeline runs unchanged.
 */
@Injectable()
export class GoogleDriveProvider implements ImportSourceProvider {
  readonly source = 'GOOGLE_DRIVE' as const;
  readonly key = 'google-drive';

  canHandle(source: 'LOCAL' | 'GOOGLE_DRIVE' | 'UPLOAD'): boolean {
    return source === 'GOOGLE_DRIVE';
  }

  async scan(_location: string): Promise<ScannedFile[]> {
    throw new NotImplementedException(
      'GoogleDriveProvider.scan() is the configured extension point — bind the Drive API here. ' +
        'Use the LOCAL provider (mounted Drive export) or the upload flow in the meantime.',
    );
  }
}
