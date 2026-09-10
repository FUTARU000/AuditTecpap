'use client';
import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import type { DocumentPreviewDto } from '@tecpap/types';

export default function CsvViewer({ preview }: { preview: DocumentPreviewDto }) {
  const c = preview.content as { headers?: string[]; rows?: string[][]; rowCount?: number; truncated?: boolean };
  const headers = c.headers ?? [];
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const sorted = useMemo(() => {
    const data = c.rows ?? [];
    if (sortCol === null) return data;
    return [...data].sort((a, b) => {
      const av = a[sortCol] ?? ''; const bv = b[sortCol] ?? '';
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [c.rows, sortCol, sortDir]);

  function toggleSort(col: number) {
    if (sortCol === col) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  }

  if (headers.length === 0) return <div className="p-8 text-sm text-muted-foreground">No CSV data</div>;

  return (
    <div className="flex max-h-[80vh] flex-col overflow-hidden rounded-md border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5 text-xs text-muted-foreground">
        <span className="font-medium">CSV Data</span>
        <span>{c.rowCount ?? (c.rows?.length ?? 0) + 1} rows{c.truncated ? ' (truncated)' : ''}</span>
      </div>
      <div className="flex-1 overflow-auto scrollbar-thin">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="bg-muted/80 backdrop-blur">
              <th className="border border-border px-1 py-1 text-center font-mono text-muted-foreground/60">#</th>
              {headers.map((h, ci) => (
                <th key={ci} className="min-w-32 border border-border px-2 py-1 text-left">
                  <button type="button" onClick={() => toggleSort(ci)} className="inline-flex items-center gap-1 font-semibold text-foreground hover:text-primary">
                    {h}
                    {sortCol === ci ? (sortDir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ChevronsUpDown className="size-3 opacity-40" />}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, ri) => (
              <tr key={ri} className="even:bg-muted/20 hover:bg-accent/30">
                <td className="border border-border px-1 py-1 text-center font-mono text-muted-foreground/60">{ri + 2}</td>
                {headers.map((_, ci) => (
                  <td key={ci} className="min-w-32 border border-border px-2 py-1 align-top text-foreground">{row[ci] ?? ''}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
