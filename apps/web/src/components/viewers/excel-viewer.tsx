'use client';
import { useState } from 'react';
import type { DocumentPreviewDto } from '@tecpap/types';

interface SheetData { name: string; rows: string[][]; columnCount: number; rowCount: number }

export default function ExcelViewer({ preview }: { preview: DocumentPreviewDto }) {
  const c = preview.content as { sheets?: SheetData[]; text?: string; workbookPurpose?: string; tables?: number; pages?: number };
  const sheets = c.sheets ?? [];
  const [activeSheet, setActiveSheet] = useState(0);

  if (sheets.length === 0) {
    return <div className="max-h-[80vh] overflow-y-auto rounded-md border border-border bg-card p-8 text-sm text-muted-foreground">{c.text || 'No worksheet data available'}</div>;
  }

  const sheet = sheets[Math.min(activeSheet, sheets.length - 1)]!;

  return (
    <div className="flex max-h-[80vh] flex-col overflow-hidden rounded-md border border-border bg-card">
      {/* Sheet tabs */}
      {sheets.length > 1 ? (
        <div className="flex gap-1 overflow-x-auto border-b border-border bg-muted/50 p-1 scrollbar-thin">
          {sheets.map((s, i) => (
            <button key={i} type="button" onClick={() => setActiveSheet(i)} className={`shrink-0 rounded-md px-3 py-1 text-xs font-medium transition-colors ${i === activeSheet ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
              {s.name}
            </button>
          ))}
        </div>
      ) : null}

      {/* Sheet info bar */}
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5 text-xs text-muted-foreground">
        <span className="font-medium">{sheet.name}</span>
        <span>{sheet.rowCount} rows × {sheet.columnCount} cols</span>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto scrollbar-thin">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="bg-muted/80 backdrop-blur">
              <th className="border border-border px-1 py-1 text-center font-mono text-muted-foreground/60">#</th>
              {sheet.rows[0]?.map((_, ci) => (
                <th key={ci} className="min-w-24 border border-border px-2 py-1 text-left font-semibold text-foreground">{sheet.rows[0]?.[ci] ?? ''}</th>
              )) ?? null}
            </tr>
          </thead>
          <tbody>
            {sheet.rows.slice(1).map((row, ri) => (
              <tr key={ri} className="even:bg-muted/20 hover:bg-accent/30">
                <td className="border border-border px-1 py-1 text-center font-mono text-muted-foreground/60">{ri + 2}</td>
                {sheet.rows[0]?.map((_, ci) => (
                  <td key={ci} className="min-w-24 border border-border px-2 py-1 align-top text-foreground">{row[ci] ?? ''}</td>
                )) ?? null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
