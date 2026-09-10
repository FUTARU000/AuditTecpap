'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import type { DocumentCompareResultDto, DocumentVersionDto } from '@tecpap/types';
import { Badge, Button } from '@tecpap/ui';
import { cn } from '@tecpap/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api, RequestError } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { ErrorState } from '@/components/admin/common';

const TONE: Record<string, string> = {
  added: 'bg-success-fg/10 text-success-fg border-success-fg/30',
  removed: 'bg-danger-fg/10 text-danger-fg border-danger-fg/30 line-through',
  modified: 'bg-warning-fg/10 text-foreground border-warning-fg/30',
  unchanged: 'border-border text-muted-foreground',
};

export default function ComparePage() {
  const params = useParams();
  const id = params?.id as string;
  const { t } = useTranslation();
  const [versions, setVersions] = useState<DocumentVersionDto[]>([]);
  const [a, setA] = useState<string>('');
  const [b, setB] = useState<string>('');
  const [result, setResult] = useState<DocumentCompareResultDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { const v = await api.get<DocumentVersionDto[]>(`/documents/${id}/versions`); setVersions(v); if (v.length >= 2) { setA(v[1]!.id); setB(v[0]!.id); } }
    catch (err) { setError(err instanceof RequestError ? err.message : 'Failed to load.'); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  async function run() {
    if (!a || !b) return;
    try { setResult(await api.get<DocumentCompareResultDto>(`/documents/${id}/compare`, { a, b })); setError(null); }
    catch (err) { setError(err instanceof RequestError ? err.message : 'Compare failed.'); }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <Link href={`/documents/${id}`} className="text-xs text-muted-foreground hover:underline">← {t('doc.compare_versions')}</Link>
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-col gap-1"><span className="text-xs text-muted-foreground">{t('doc.version_a')}</span>
          <Select value={a} onValueChange={setA}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent>{versions.map((v) => <SelectItem key={v.id} value={v.id}>v{v.version}</SelectItem>)}</SelectContent></Select>
        </div>
        <ArrowRight className="mb-2 size-4 text-muted-foreground" />
        <div className="flex flex-col gap-1"><span className="text-xs text-muted-foreground">{t('doc.version_b')}</span>
          <Select value={b} onValueChange={setB}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent>{versions.map((v) => <SelectItem key={v.id} value={v.id}>v{v.version}</SelectItem>)}</SelectContent></Select>
        </div>
        <Button size="sm" onClick={() => void run()} disabled={!a || !b || a === b}>{t('doc.compare')}</Button>
      </div>

      {error ? <ErrorState message={error} /> : null}
      {result ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="success">{t('doc.added')}: {result.summary.added}</Badge>
            <Badge variant="danger">{t('doc.removed')}: {result.summary.removed}</Badge>
            <Badge variant="warning">{t('doc.modified')}: {result.summary.modified}</Badge>
          </div>
          {result.metadataDiff.length > 0 ? (
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Metadata</p>
              <ul className="flex flex-col gap-1 text-sm">{result.metadataDiff.map((d) => <li key={d.field}><span className="font-mono text-xs">{d.field}:</span> <span className="text-danger-fg line-through">{String(d.a)}</span> → <span className="text-success-fg">{String(d.b)}</span></li>)}</ul>
            </div>
          ) : null}
          <div className="rounded-lg border border-border bg-card p-3">
            <ul className="flex flex-col gap-1.5">
              {result.blocks.map((bl, i) => (
                <li key={i} className={cn('rounded-md border px-3 py-2 text-sm', TONE[bl.status])}>
                  <span className="mr-2 text-[10px] font-bold uppercase">{bl.status}</span>
                  {bl.status === 'modified' ? <><span className="line-through">{bl.a}</span> → <span>{bl.b}</span></> : (bl.a ?? bl.b)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
