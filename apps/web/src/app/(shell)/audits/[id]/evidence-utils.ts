import { File, FileText, Image as ImageIcon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { api } from '@/lib/api';

export function fileIcon(mime: string): LucideIcon {
  if (mime.startsWith('image/')) return ImageIcon;
  if (mime === 'application/pdf') return FileText;
  return File;
}

export function isImage(mime: string): boolean {
  return mime.startsWith('image/');
}

export function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

/**
 * Two-step evidence fetch — the same fix already applied to the CAPA evidence
 * viewer. The authenticated API call returns a presigned MinIO URL as JSON
 * (`{ url }`); it is NOT the file's bytes. The browser must fetch that URL
 * separately (unauthenticated — the authorization already happened server-side
 * when the URL was minted) to get the actual image/file content. Passing the
 * first response's body straight to `<img>`/a download link produces a broken
 * image or a JSON file, which was the root cause of the Audit evidence bug.
 */
export async function fetchEvidenceBlob(auditId: string, evidenceId: string): Promise<Blob> {
  const { url } = await api.get<{ url: string }>(
    `/audits/${auditId}/evidence/${evidenceId}/download`,
  );
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch evidence bytes');
  return res.blob();
}
