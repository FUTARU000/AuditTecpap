import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import { GoogleDriveProvider } from './google-drive.provider';

const filesList = vi.fn();
const filesGet = vi.fn();
const filesExport = vi.fn();
const googleAuthCtor = vi.fn();
const driveCtor = vi.fn();

vi.mock('googleapis', () => ({
  google: {
    auth: { GoogleAuth: class { constructor(opts: unknown) { googleAuthCtor(opts); } } },
    drive: (opts: unknown) => { driveCtor(opts); return { files: { list: filesList, get: filesGet, export: filesExport } }; },
  },
}));

const SERVICE_ACCOUNT_JSON = JSON.stringify({
  type: 'service_account',
  client_email: 'tecpap-import@example.iam.gserviceaccount.com',
  private_key: '-----BEGIN PRIVATE KEY-----\nFAKE\n-----END PRIVATE KEY-----\n',
});

function arrayBufferOf(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer as ArrayBuffer;
}

function configService(vars: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => vars[key] } as unknown as ConfigService;
}

describe('GoogleDriveProvider', () => {
  beforeEach(() => {
    filesList.mockReset();
    filesGet.mockReset();
    filesExport.mockReset();
    googleAuthCtor.mockReset();
    driveCtor.mockReset();
  });

  it('canHandle only recognizes GOOGLE_DRIVE', () => {
    const provider = new GoogleDriveProvider(configService({}));
    expect(provider.canHandle('GOOGLE_DRIVE')).toBe(true);
    expect(provider.canHandle('LOCAL')).toBe(false);
    expect(provider.canHandle('UPLOAD')).toBe(false);
  });

  it('1. authenticates with the configured service account, scoped read-only', async () => {
    filesList.mockResolvedValue({ data: { files: [] } });
    const provider = new GoogleDriveProvider(
      configService({ GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON: SERVICE_ACCOUNT_JSON, GOOGLE_DRIVE_FOLDER_ID: 'root-folder' }),
    );
    await provider.scan('');
    expect(googleAuthCtor).toHaveBeenCalledWith(
      expect.objectContaining({
        credentials: expect.objectContaining({ client_email: 'tecpap-import@example.iam.gserviceaccount.com' }),
        scopes: ['https://www.googleapis.com/auth/drive.readonly'],
      }),
    );
    expect(driveCtor).toHaveBeenCalledWith(expect.objectContaining({ version: 'v3' }));
  });

  it('2a. fails clearly when GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON is missing', async () => {
    const provider = new GoogleDriveProvider(configService({ GOOGLE_DRIVE_FOLDER_ID: 'root-folder' }));
    await expect(provider.scan('')).rejects.toThrow(/not configured/i);
    expect(filesList).not.toHaveBeenCalled();
  });

  it('2b. fails clearly when no folder id is configured or supplied', async () => {
    const provider = new GoogleDriveProvider(configService({ GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON: SERVICE_ACCOUNT_JSON }));
    await expect(provider.scan('')).rejects.toThrow(/no google drive folder configured/i);
    expect(filesList).not.toHaveBeenCalled();
  });

  it('2c. fails clearly when the service account JSON is malformed', async () => {
    const provider = new GoogleDriveProvider(
      configService({ GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON: '{not valid json', GOOGLE_DRIVE_FOLDER_ID: 'root-folder' }),
    );
    await expect(provider.scan('')).rejects.toThrow(/not valid json/i);
  });

  it('3. lists files in the configured Drive folder via the mocked Drive API', async () => {
    filesList.mockResolvedValue({
      data: { files: [{ id: 'f1', name: 'PROC-014.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: '2048', modifiedTime: '2026-01-05T00:00:00.000Z' }] },
    });
    const provider = new GoogleDriveProvider(
      configService({ GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON: SERVICE_ACCOUNT_JSON, GOOGLE_DRIVE_FOLDER_ID: 'root-folder' }),
    );
    const files = await provider.scan('');
    expect(filesList).toHaveBeenCalledWith(expect.objectContaining({ q: "'root-folder' in parents and trashed = false" }));
    expect(files).toHaveLength(1);
  });

  it('4. converts Drive file metadata into the exact ScannedFile shape (incl. nested folders)', async () => {
    filesList.mockImplementation(({ q }: { q: string }) => {
      if (q.includes("'root-folder'")) return Promise.resolve({ data: { files: [{ id: 'sub1', name: 'Procedures', mimeType: 'application/vnd.google-apps.folder' }] } });
      if (q.includes("'sub1'")) return Promise.resolve({ data: { files: [{ id: 'f1', name: 'PROC-014.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: '2048', modifiedTime: '2026-01-05T00:00:00.000Z' }] } });
      return Promise.resolve({ data: { files: [] } });
    });
    const provider = new GoogleDriveProvider(
      configService({ GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON: SERVICE_ACCOUNT_JSON, GOOGLE_DRIVE_FOLDER_ID: 'root-folder' }),
    );
    const files = await provider.scan('');
    expect(files).toHaveLength(1);
    const file = files[0]!;
    expect(file).toMatchObject({
      fileName: 'PROC-014.docx',
      originalPath: 'Procedures/PROC-014.docx',
      relativePath: 'Procedures/PROC-014.docx',
      parentFolder: 'Procedures',
      extension: 'docx',
      sizeBytes: 2048,
    });
    expect(file.modifiedAt).toEqual(new Date('2026-01-05T00:00:00.000Z'));
  });

  it('5. downloads a binary (already-supported) file via files.get(alt=media)', async () => {
    filesList.mockResolvedValue({ data: { files: [{ id: 'f1', name: 'report.pdf', mimeType: 'application/pdf', size: '10' }] } });
    filesGet.mockResolvedValue({ data: arrayBufferOf('%PDF-fake') });
    const provider = new GoogleDriveProvider(
      configService({ GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON: SERVICE_ACCOUNT_JSON, GOOGLE_DRIVE_FOLDER_ID: 'root-folder' }),
    );
    const files = await provider.scan('');
    expect(files).toHaveLength(1);
    const file = files[0]!;
    const buffer = await file.read();
    expect(filesGet).toHaveBeenCalledWith({ fileId: 'f1', alt: 'media' }, { responseType: 'arraybuffer' });
    expect(buffer.toString()).toBe('%PDF-fake');
  });

  it('6. exports a Google Doc to .docx via files.export', async () => {
    filesList.mockResolvedValue({ data: { files: [{ id: 'g1', name: 'Quality Manual', mimeType: 'application/vnd.google-apps.document' }] } });
    filesExport.mockResolvedValue({ data: arrayBufferOf('docx-bytes') });
    const provider = new GoogleDriveProvider(
      configService({ GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON: SERVICE_ACCOUNT_JSON, GOOGLE_DRIVE_FOLDER_ID: 'root-folder' }),
    );
    const files = await provider.scan('');
    expect(files).toHaveLength(1);
    const file = files[0]!;
    expect(file.fileName).toBe('Quality Manual.docx');
    expect(file.extension).toBe('docx');
    expect(file.mimeType).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    await file.read();
    expect(filesExport).toHaveBeenCalledWith({ fileId: 'g1', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }, { responseType: 'arraybuffer' });
  });

  it('7. exports a Google Sheet to .xlsx via files.export', async () => {
    filesList.mockResolvedValue({ data: { files: [{ id: 'g2', name: 'CAPA Register', mimeType: 'application/vnd.google-apps.spreadsheet' }] } });
    filesExport.mockResolvedValue({ data: arrayBufferOf('xlsx-bytes') });
    const provider = new GoogleDriveProvider(
      configService({ GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON: SERVICE_ACCOUNT_JSON, GOOGLE_DRIVE_FOLDER_ID: 'root-folder' }),
    );
    const files = await provider.scan('');
    expect(files).toHaveLength(1);
    const file = files[0]!;
    expect(file.fileName).toBe('CAPA Register.xlsx');
    await file.read();
    expect(filesExport).toHaveBeenCalledWith({ fileId: 'g2', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }, { responseType: 'arraybuffer' });
  });

  it('8. exports a Google Slides deck to .pptx via files.export', async () => {
    filesList.mockResolvedValue({ data: { files: [{ id: 'g3', name: 'Audit Kickoff', mimeType: 'application/vnd.google-apps.presentation' }] } });
    filesExport.mockResolvedValue({ data: arrayBufferOf('pptx-bytes') });
    const provider = new GoogleDriveProvider(
      configService({ GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON: SERVICE_ACCOUNT_JSON, GOOGLE_DRIVE_FOLDER_ID: 'root-folder' }),
    );
    const files = await provider.scan('');
    expect(files).toHaveLength(1);
    const file = files[0]!;
    expect(file.fileName).toBe('Audit Kickoff.pptx');
    await file.read();
    expect(filesExport).toHaveBeenCalledWith({ fileId: 'g3', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }, { responseType: 'arraybuffer' });
  });

  it('9. skips unsupported Google-native and binary types instead of corrupting them', async () => {
    filesList.mockResolvedValue({
      data: {
        files: [
          { id: 'form1', name: 'Feedback Form', mimeType: 'application/vnd.google-apps.form' },
          { id: 'exe1', name: 'installer.exe', mimeType: 'application/x-msdownload', size: '99' },
          { id: 'ok1', name: 'spec.pdf', mimeType: 'application/pdf', size: '5' },
        ],
      },
    });
    const provider = new GoogleDriveProvider(
      configService({ GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON: SERVICE_ACCOUNT_JSON, GOOGLE_DRIVE_FOLDER_ID: 'root-folder' }),
    );
    const files = await provider.scan('');
    expect(files.map((f) => f.fileName)).toEqual(['spec.pdf']);
    expect(filesGet).not.toHaveBeenCalled();
    expect(filesExport).not.toHaveBeenCalled();
  });

  it('10. surfaces a Drive API error clearly, without leaking the credential', async () => {
    filesList.mockRejectedValue(new Error('403 The caller does not have permission'));
    const provider = new GoogleDriveProvider(
      configService({ GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON: SERVICE_ACCOUNT_JSON, GOOGLE_DRIVE_FOLDER_ID: 'root-folder' }),
    );
    await expect(provider.scan('')).rejects.toThrow(/failed to list google drive folder.*403/i);
    const rejection = await provider.scan('').catch((e: Error) => e.message);
    expect(rejection).not.toContain('FAKE');
    expect(rejection).not.toContain('BEGIN PRIVATE KEY');
  });

  it('an explicit location argument overrides the configured default folder id', async () => {
    filesList.mockResolvedValue({ data: { files: [] } });
    const provider = new GoogleDriveProvider(
      configService({ GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON: SERVICE_ACCOUNT_JSON, GOOGLE_DRIVE_FOLDER_ID: 'default-folder' }),
    );
    await provider.scan('explicit-folder');
    expect(filesList).toHaveBeenCalledWith(expect.objectContaining({ q: "'explicit-folder' in parents and trashed = false" }));
  });
});
