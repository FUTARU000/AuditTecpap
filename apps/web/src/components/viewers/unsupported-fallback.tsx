'use client';
import { Download, FileWarning } from 'lucide-react';
import type { DocumentPreviewDto } from '@tecpap/types';

export default function UnsupportedFallback({ preview, metadata }: { preview: DocumentPreviewDto; metadata: Record<string, unknown> }) {
  const c = preview.content as { ext?: string; reason?: string; error?: string };
  const ext = c.ext ?? (metadata.fileName as string)?.split('.').pop() ?? 'unknown';
  const reason = c.reason ?? c.error ?? 'No inline preview available for this file type.';

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-md border border-border bg-card p-8 text-center">
      <FileWarning className="mb-4 size-16 text-muted-foreground/40" strokeWidth={1} />
      <h3 className="text-lg font-semibold text-foreground">No inline preview</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{reason}</p>
      <div className="mt-6 flex gap-3">
        <a href={preview.fileUrl} download className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Download className="size-4" /> Download
        </a>
      </div>
      <div className="mt-4 text-xs text-muted-foreground">
        <span className="font-mono">{metadata.fileName as string}</span>
        <span className="mx-2">·</span>
        <span>{((metadata.sizeBytes as number) / 1024).toFixed(0)} KB</span>
        <span className="mx-2">·</span>
        <code className="rounded bg-muted px-1 py-0.5">.{ext}</code>
      </div>
    </div>
  );
}
