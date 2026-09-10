'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { DocumentInsightsDto } from '@tecpap/types';
import { api, RequestError } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { ErrorState, PageHeader } from '@/components/admin/common';

export default function InsightsPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<DocumentInsightsDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { setData(await api.get<DocumentInsightsDto>('/documents/insights')); setError(null); }
    catch (err) { setError(err instanceof RequestError ? err.message : 'Failed to load.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  if (error) return <div className="mx-auto max-w-6xl"><ErrorState message={error} onRetry={() => void load()} /></div>;
  if (!data) return <div className="mx-auto max-w-6xl p-8 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <PageHeader title={t('doc.insights')} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t('doc.pending_review')} value={data.pendingReview} tone="text-warning-fg" />
        <Stat label={t('doc.expiring_soon')} value={data.expiringSoon} tone="text-danger-fg" />
        <Stat label="Avg review (revs)" value={data.averageReviewDays ?? 0} />
        <Stat label={t('doc.recently_updated')} value={data.recentlyUpdated.length} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <List title={t('doc.most_viewed')} rows={data.mostViewed.map((d) => ({ id: d.id, label: `${d.code} — ${d.title}`, right: String(d.count) }))} />
        <List title={t('doc.most_downloaded')} rows={data.mostDownloaded.map((d) => ({ id: d.id, label: `${d.code} — ${d.title}`, right: String(d.count) }))} />
        <List title={t('doc.most_commented')} rows={data.mostCommented.map((d) => ({ id: d.id, label: `${d.code} — ${d.title}`, right: String(d.count) }))} />
        <List title={t('doc.most_acknowledged')} rows={data.mostAcknowledged.map((d) => ({ id: d.id, label: `${d.code} — ${d.title}`, right: String(d.count) }))} />
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) { return <div className="rounded-lg border border-border bg-card p-4"><div className={`text-2xl font-semibold ${tone ?? ''}`}>{value}</div><div className="text-xs text-muted-foreground">{label}</div></div>; }
function List({ title, rows }: { title: string; rows: { id: string; label: string; right: string }[] }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {rows.length === 0 ? <p className="text-xs text-muted-foreground">—</p> : (
        <ul className="flex flex-col gap-1">{rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-2 text-sm"><Link href={`/documents/${r.id}/viewer`} className="min-w-0 flex-1 truncate text-foreground hover:underline">{r.label}</Link><span className="text-xs text-muted-foreground">{r.right}</span></li>
        ))}</ul>
      )}
    </section>
  );
}
