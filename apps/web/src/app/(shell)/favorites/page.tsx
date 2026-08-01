'use client';

import { useCallback, useEffect, useState } from 'react';
import { Star, Trash2 } from 'lucide-react';
import type { FavoriteDto } from '@tecpap/types';
import { Button, Input, Label } from '@tecpap/ui';
import { api, RequestError } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { EmptyState, ErrorState, PageHeader } from '@/components/admin/common';

export default function FavoritesPage() {
  const { t } = useTranslation();
  const [favs, setFavs] = useState<FavoriteDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ label: '', href: '', entityType: 'document', entityId: '' });

  const load = useCallback(async () => {
    try { setFavs(await api.get<FavoriteDto[]>('/favorites')); setError(null); } catch (err) { setError(err instanceof RequestError ? err.message : 'Failed to load.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function add() {
    if (!form.label || !form.href || !form.entityId) return;
    try { await api.post('/favorites', { ...form }); setForm({ label: '', href: '', entityType: 'document', entityId: '' }); await load(); } catch { /* ignore */ }
  }
  async function remove(id: string) { try { await api.delete(`/favorites/${id}`); await load(); } catch { /* ignore */ } }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <PageHeader title={t('productivity.favorites')} />
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      <section className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold">{t('favorites.add')}</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1"><Label className="text-xs text-muted-foreground">Label</Label><Input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} /></div>
          <div className="flex flex-col gap-1"><Label className="text-xs text-muted-foreground">Type</Label>
            <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={form.entityType} onChange={(e) => setForm((f) => ({ ...f, entityType: e.target.value }))}>
              {['document', 'process', 'audit', 'capa', 'risk', 'kpi', 'page'].map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1"><Label className="text-xs text-muted-foreground">ID</Label><Input value={form.entityId} onChange={(e) => setForm((f) => ({ ...f, entityId: e.target.value }))} /></div>
          <div className="flex flex-col gap-1"><Label className="text-xs text-muted-foreground">Path (/…)</Label><Input value={form.href} onChange={(e) => setForm((f) => ({ ...f, href: e.target.value }))} placeholder="/documents/…" /></div>
        </div>
        <Button size="sm" className="mt-3" onClick={() => void add()}><Star className="size-4" /> {t('favorites.add')}</Button>
      </section>

      {!favs ? <div className="h-16 animate-pulse rounded-md bg-muted" /> : favs.length === 0 ? (
        <EmptyState title={t('favorites.empty')} />
      ) : (
        <ul className="flex flex-col gap-2">
          {favs.map((f) => (
            <li key={f.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
              <Star className="size-4 shrink-0 fill-warning-fg text-warning-fg" />
              <a href={f.href} className="min-w-0 flex-1 truncate text-sm font-medium text-foreground hover:underline">{f.label}</a>
              <span className="text-xs uppercase text-muted-foreground">{f.entityType}</span>
              <Button size="icon" variant="ghost" className="size-7" onClick={() => void remove(f.id)} aria-label="Remove"><Trash2 className="size-3.5" /></Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
