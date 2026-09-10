import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { ImportScanner } from './import-scanner';
import type { LocalFolderProvider } from './providers/local-folder.provider';
import type { GoogleDriveProvider } from './providers/google-drive.provider';

function fakeFile(name: string) {
  return { originalPath: name, relativePath: name, fileName: name, extension: 'pdf', mimeType: 'application/pdf', sizeBytes: 1, parentFolder: null, read: vi.fn() };
}

describe('ImportScanner — provider resolution', () => {
  it('11. resolves GOOGLE_DRIVE to GoogleDriveProvider and scans through it', async () => {
    const local = { source: 'LOCAL', key: 'local', canHandle: (s: string) => s === 'LOCAL', scan: vi.fn() } as unknown as LocalFolderProvider;
    const drive = { source: 'GOOGLE_DRIVE', key: 'google-drive', canHandle: (s: string) => s === 'GOOGLE_DRIVE', scan: vi.fn().mockResolvedValue([fakeFile('a.pdf')]) } as unknown as GoogleDriveProvider;
    const scanner = new ImportScanner(local, drive);

    const files = await scanner.scan('GOOGLE_DRIVE', 'folder-id');

    expect(drive.scan).toHaveBeenCalledWith('folder-id');
    expect((local.scan as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
    expect(files).toHaveLength(1);
  });

  it('13. still resolves LOCAL to LocalFolderProvider unchanged', async () => {
    const local = { source: 'LOCAL', key: 'local', canHandle: (s: string) => s === 'LOCAL', scan: vi.fn().mockResolvedValue([fakeFile('b.pdf')]) } as unknown as LocalFolderProvider;
    const drive = { source: 'GOOGLE_DRIVE', key: 'google-drive', canHandle: (s: string) => s === 'GOOGLE_DRIVE', scan: vi.fn() } as unknown as GoogleDriveProvider;
    const scanner = new ImportScanner(local, drive);

    const files = await scanner.scan('LOCAL', '/mnt/legacy');

    expect(local.scan).toHaveBeenCalledWith('/mnt/legacy');
    expect((drive.scan as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
    expect(files).toHaveLength(1);
  });

  it('rejects a source no registered provider can handle, with a clear error (no arbitrary provider strings)', async () => {
    const local = { source: 'LOCAL', key: 'local', canHandle: () => false, scan: vi.fn() } as unknown as LocalFolderProvider;
    const drive = { source: 'GOOGLE_DRIVE', key: 'google-drive', canHandle: () => false, scan: vi.fn() } as unknown as GoogleDriveProvider;
    const scanner = new ImportScanner(local, drive);

    // UPLOAD is a valid ImportSource, but neither scan-time provider claims to handle it
    // (uploads bypass the scanner entirely) — the scanner must reject it, not guess.
    await expect(scanner.scan('UPLOAD', 'x')).rejects.toThrow(BadRequestException);
  });

  it('throws a clear error when the provider finds no supported files', async () => {
    const local = { source: 'LOCAL', key: 'local', canHandle: (s: string) => s === 'LOCAL', scan: vi.fn().mockResolvedValue([]) } as unknown as LocalFolderProvider;
    const drive = { source: 'GOOGLE_DRIVE', key: 'google-drive', canHandle: (s: string) => s === 'GOOGLE_DRIVE', scan: vi.fn() } as unknown as GoogleDriveProvider;
    const scanner = new ImportScanner(local, drive);

    await expect(scanner.scan('LOCAL', '/empty')).rejects.toThrow(BadRequestException);
  });
});
