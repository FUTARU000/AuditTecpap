'use client';
import { Download, FileSpreadsheet, FileText, Presentation } from 'lucide-react';
import type { DocumentPreviewDto } from '@tecpap/types';

const FAMILY_ICON = { word: FileText, excel: FileSpreadsheet, powerpoint: Presentation };
const FAMILY_LABEL = { word: 'Word', excel: 'Excel', powerpoint: 'PowerPoint' };

export default function LegacyFallback({ preview, metadata }: { preview: DocumentPreviewDto; metadata: Record<string, unknown> }) {
  const c = preview.content as { family?: 'word' | 'excel' | 'powerpoint'; ext?: string; reason?: string };
  const family = c.family ?? 'word';
  const Icon = FAMILY_ICON[family] ?? FileText;
  const ext = c.ext ?? (metadata.fileName as string)?.split('.').pop() ?? '';

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-md border border-border bg-card p-8 text-center">
      <Icon className="mb-4 size-16 text-muted-foreground/40" strokeWidth={1} />
      <h3 className="text-lg font-semibold text-foreground">Preview unavailable</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        This legacy Microsoft {FAMILY_LABEL[family]} format (<code className="rounded bg-muted px-1 py-0.5 text-xs">.{ext}</code>) cannot be rendered directly in the browser.
      </p>
      <p className="mt-1 text-xs text-muted-foreground">The document has been stored successfully and is available for download, versioning, and approval.</p>
      <div className="mt-6 flex gap-3">
        <a href={preview.fileUrl} download className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Download className="size-4" /> Download Original
        </a>
      </div>
      <div className="mt-4 text-xs text-muted-foreground">
        <span>{metadata.fileName as string}</span>
        <span className="mx-2">·</span>
        <span>{((metadata.sizeBytes as number) / 1024).toFixed(0)} KB</span>
        <span className="mx-2">·</span>
        <span>v{metadata.version as string}</span>
      </div>
    </div>
  );
}
