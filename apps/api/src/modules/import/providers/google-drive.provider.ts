import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, type drive_v3 } from 'googleapis';
import { EXTENSION_FORMAT, SUPPORTED_FILE_TYPES } from '@tecpap/config';
import type { ImportSourceProvider, ScannedFile } from '../interfaces/import-provider.interface';

/** Google-native document → the OOXML format the existing parsers already handle. */
const GOOGLE_NATIVE_EXPORTS: Readonly<Record<string, { mimeType: string; extension: string }>> = {
  'application/vnd.google-apps.document': {
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extension: 'docx',
  },
  'application/vnd.google-apps.spreadsheet': {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extension: 'xlsx',
  },
  'application/vnd.google-apps.presentation': {
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    extension: 'pptx',
  },
};

const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
const DRIVE_LIST_FIELDS = 'nextPageToken, files(id, name, mimeType, modifiedTime, size)';

/**
 * Google Drive provider — a MANUAL import source only. A user explicitly
 * triggers a scan (via the existing `/import/scan` endpoint with
 * `source: 'GOOGLE_DRIVE'`); there is no polling, no webhook, no scheduled
 * sync. Returns the exact same `ScannedFile[]` shape as LocalFolderProvider,
 * so the rest of the import pipeline (parse/classify/duplicate/review/
 * materialize) requires no changes at all.
 *
 * Auth: a server-side Google service account (JSON key in
 * GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON), scoped read-only to Drive. The service
 * account must itself be shared on the target Drive folder — there is no
 * per-user OAuth flow, since TECPAP imports from one shared organizational
 * Drive location rather than individual users' own Drive accounts.
 */
@Injectable()
export class GoogleDriveProvider implements ImportSourceProvider {
  readonly source = 'GOOGLE_DRIVE' as const;
  readonly key = 'google-drive';
  private readonly logger = new Logger(GoogleDriveProvider.name);

  constructor(private readonly config: ConfigService) {}

  canHandle(source: 'LOCAL' | 'GOOGLE_DRIVE' | 'UPLOAD'): boolean {
    return source === 'GOOGLE_DRIVE';
  }

  async scan(location: string): Promise<ScannedFile[]> {
    const folderId = (location || '').trim() || this.config.get<string>('GOOGLE_DRIVE_FOLDER_ID');
    if (!folderId) {
      throw new BadRequestException(
        'No Google Drive folder configured. Set GOOGLE_DRIVE_FOLDER_ID, or pass a folder id explicitly.',
      );
    }
    const drive = this.buildClient();
    const out: ScannedFile[] = [];
    await this.walk(drive, folderId, '', out);
    return out;
  }

  /** Builds an authenticated Drive client from the configured service account. Never logs the credential. */
  private buildClient(): drive_v3.Drive {
    const raw = this.config.get<string>('GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON');
    if (!raw) {
      throw new BadRequestException(
        'Google Drive is not configured (GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON is missing).',
      );
    }
    let credentials: { client_email?: string; private_key?: string };
    try {
      credentials = JSON.parse(raw) as { client_email?: string; private_key?: string };
    } catch {
      throw new BadRequestException('GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON is not valid JSON.');
    }
    if (!credentials.client_email || !credentials.private_key) {
      throw new BadRequestException('GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON is missing client_email/private_key.');
    }
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
    return google.drive({ version: 'v3', auth });
  }

  /** Recursively enumerates a Drive folder, mirroring LocalFolderProvider's directory walk. */
  private async walk(drive: drive_v3.Drive, folderId: string, relPrefix: string, out: ScannedFile[]): Promise<void> {
    let pageToken: string | undefined;
    do {
      let page: drive_v3.Schema$FileList;
      try {
        const res = await drive.files.list({
          q: `'${folderId}' in parents and trashed = false`,
          fields: DRIVE_LIST_FIELDS,
          pageSize: 200,
          pageToken,
        });
        page = res.data;
      } catch (error) {
        throw this.wrapDriveError(error, 'Failed to list Google Drive folder');
      }

      for (const file of page.files ?? []) {
        if (!file.id || !file.name) continue;
        if (file.mimeType === FOLDER_MIME_TYPE) {
          await this.walk(drive, file.id, relPrefix ? `${relPrefix}/${file.name}` : file.name, out);
          continue;
        }
        const scanned = this.toScannedFile(drive, file, relPrefix);
        // Unsupported native types (Forms, Drawings, shortcuts, …) are skipped at
        // scan time — same convention LocalFolderProvider uses for unknown extensions.
        if (scanned) out.push(scanned);
      }
      pageToken = page.nextPageToken ?? undefined;
    } while (pageToken);
  }

  private toScannedFile(drive: drive_v3.Drive, file: drive_v3.Schema$File, relPrefix: string): ScannedFile | null {
    const native = file.mimeType ? GOOGLE_NATIVE_EXPORTS[file.mimeType] : undefined;
    let extension: string;
    let mimeType: string;
    let fileName: string;
    let read: () => Promise<Buffer>;

    if (native) {
      extension = native.extension;
      mimeType = native.mimeType;
      fileName = `${this.stripExtension(file.name!)}.${extension}`;
      read = () => this.exportFile(drive, file.id!, native.mimeType);
    } else {
      const ext = (file.name!.split('.').pop() ?? '').toLowerCase();
      if (!EXTENSION_FORMAT[ext]) return null;
      extension = ext;
      fileName = file.name!;
      mimeType = file.mimeType || SUPPORTED_FILE_TYPES[ext] || 'application/octet-stream';
      read = () => this.downloadFile(drive, file.id!);
    }

    const relativePath = relPrefix ? `${relPrefix}/${fileName}` : fileName;
    return {
      originalPath: relativePath,
      relativePath,
      fileName,
      extension,
      mimeType,
      sizeBytes: file.size ? Number(file.size) : 0,
      parentFolder: relPrefix || null,
      modifiedAt: file.modifiedTime ? new Date(file.modifiedTime) : undefined,
      read,
    };
  }

  private async downloadFile(drive: drive_v3.Drive, fileId: string): Promise<Buffer> {
    try {
      const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' });
      return Buffer.from(res.data as ArrayBuffer);
    } catch (error) {
      throw this.wrapDriveError(error, 'Failed to download Google Drive file');
    }
  }

  private async exportFile(drive: drive_v3.Drive, fileId: string, exportMimeType: string): Promise<Buffer> {
    try {
      const res = await drive.files.export({ fileId, mimeType: exportMimeType }, { responseType: 'arraybuffer' });
      return Buffer.from(res.data as ArrayBuffer);
    } catch (error) {
      throw this.wrapDriveError(error, 'Failed to export Google-native file');
    }
  }

  private stripExtension(name: string): string {
    const idx = name.lastIndexOf('.');
    return idx > 0 ? name.slice(0, idx) : name;
  }

  /** Surfaces a clear, actionable message without ever logging the credential or an access token. */
  private wrapDriveError(error: unknown, context: string): Error {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.warn(`${context}: ${message}`);
    return new Error(`${context}: ${message}`);
  }
}
