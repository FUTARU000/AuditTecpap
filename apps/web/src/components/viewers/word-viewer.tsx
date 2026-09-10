'use client';
import { useEffect, useMemo } from 'react';
import DOMPurify from 'dompurify';
import type { DocumentPreviewDto } from '@tecpap/types';

export default function WordViewer({ preview }: { preview: DocumentPreviewDto }) {
  const c = preview.content as { html?: string; headings?: string[]; text?: string; author?: string; revision?: string; tables?: number };

  const sanitized = useMemo(() => {
    if (!c.html) return '';
    return DOMPurify.sanitize(c.html, { USE_PROFILES: { html: true } });
  }, [c.html]);

  // Assign ids to headings for TOC navigation
  useEffect(() => {
    const container = document.querySelector('.docx-content');
    if (!container) return;
    const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headings.forEach((h, i) => { if (!h.id) h.id = `heading-${i}`; });
  }, [sanitized]);

  if (!c.html) {
    return (
      <div className="max-h-[80vh] overflow-y-auto rounded-md border border-border bg-card p-8">
        {c.headings?.length ? (
          <div className="mb-4"><p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Table of Contents</p>
            <ul className="flex flex-col gap-0.5">{c.headings.map((h, i) => <li key={i} className="text-sm text-primary">{h}</li>)}</ul>
          </div>
        ) : null}
        <div className="whitespace-pre-wrap text-sm text-foreground/90">{c.text || 'No previewable text'}</div>
      </div>
    );
  }

  return (
    <div className="flex max-h-[80vh] gap-4 overflow-hidden">
      {c.headings && c.headings.length > 0 ? (
        <nav className="hidden w-48 shrink-0 overflow-y-auto border-r border-border pr-2 lg:block">
          <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Contents</p>
          <ul className="flex flex-col gap-1">
            {c.headings.map((h, i) => (
              <li key={i}><a href={`#heading-${i}`} className="block truncate rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground">{h}</a></li>
            ))}
          </ul>
        </nav>
      ) : null}
      <div className="docx-content min-w-0 flex-1 overflow-y-auto rounded-md bg-white p-8 shadow-sm scrollbar-thin" dangerouslySetInnerHTML={{ __html: sanitized }} />
    </div>
  );
}
