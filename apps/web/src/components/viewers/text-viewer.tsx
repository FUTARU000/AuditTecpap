'use client';
import type { DocumentPreviewDto } from '@tecpap/types';

export default function TextViewer({ preview }: { preview: DocumentPreviewDto }) {
  const c = preview.content as { text?: string; lineCount?: number; truncated?: boolean };
  const lines = (c.text ?? '').split('\n');
  return (
    <div className="flex max-h-[80vh] flex-col overflow-hidden rounded-md border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5 text-xs text-muted-foreground">
        <span className="font-medium">Plain Text</span>
        <span>{c.lineCount ?? lines.length} lines{c.truncated ? ' (truncated)' : ''}</span>
      </div>
      <div className="flex-1 overflow-auto scrollbar-thin">
        <pre className="p-4 font-mono text-xs leading-relaxed text-foreground/90"><code>{c.text}</code></pre>
      </div>
    </div>
  );
}
