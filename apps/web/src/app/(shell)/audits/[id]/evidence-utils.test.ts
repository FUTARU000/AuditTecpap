import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import { fetchEvidenceBlob, isImage } from './evidence-utils';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }));

describe('isImage — decides whether the preview modal attempts an <img> render', () => {
  it('image/jpeg is treated as an image', () => expect(isImage('image/jpeg')).toBe(true));
  it('image/png is treated as an image', () => expect(isImage('image/png')).toBe(true));
  it('application/pdf is not treated as an image (no image preview attempted)', () =>
    expect(isImage('application/pdf')).toBe(false));
  it('an arbitrary unsupported type is not treated as an image', () =>
    expect(isImage('application/octet-stream')).toBe(false));
});

describe('fetchEvidenceBlob — the CAPA-viewer two-step fetch, applied to Audit evidence', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.mocked(api.get).mockReset();
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('fetches the authenticated API JSON {url} response first, then fetches THAT presigned url for the actual bytes — never treats the JSON response itself as the file', async () => {
    vi.mocked(api.get).mockResolvedValue({ url: 'https://minio.local/signed?sig=abc' });
    const fakeImageBlob = new Blob(['fake-image-bytes'], { type: 'image/png' });
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, blob: () => Promise.resolve(fakeImageBlob) });
    global.fetch = fetchMock as unknown as typeof fetch;

    const blob = await fetchEvidenceBlob('audit-1', 'ev-1');

    expect(api.get).toHaveBeenCalledWith('/audits/audit-1/evidence/ev-1/download');
    expect(fetchMock).toHaveBeenCalledWith('https://minio.local/signed?sig=abc');
    expect(blob).toBe(fakeImageBlob);
  });

  it('works the same way for image/jpeg evidence', async () => {
    vi.mocked(api.get).mockResolvedValue({ url: 'https://minio.local/signed-jpeg' });
    const fakeJpeg = new Blob(['jpeg-bytes'], { type: 'image/jpeg' });
    global.fetch = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(fakeJpeg),
      }) as unknown as typeof fetch;

    const blob = await fetchEvidenceBlob('audit-1', 'ev-2');
    expect(blob.type).toBe('image/jpeg');
  });

  it('throws when the presigned URL fetch fails, so the caller shows an error instead of a broken image', async () => {
    vi.mocked(api.get).mockResolvedValue({ url: 'https://minio.local/signed' });
    global.fetch = vi.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;

    await expect(fetchEvidenceBlob('audit-1', 'ev-3')).rejects.toThrow();
  });

  it('never calls fetch on the API path itself — only on the presigned MinIO url the API returned', async () => {
    vi.mocked(api.get).mockResolvedValue({ url: 'https://minio.local/signed' });
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, blob: () => Promise.resolve(new Blob()) });
    global.fetch = fetchMock as unknown as typeof fetch;

    await fetchEvidenceBlob('audit-9', 'ev-9');

    const [calledUrl] = fetchMock.mock.calls[0]!;
    expect(calledUrl).not.toContain('/audits/audit-9/evidence/ev-9/download');
    expect(calledUrl).toBe('https://minio.local/signed');
  });
});
