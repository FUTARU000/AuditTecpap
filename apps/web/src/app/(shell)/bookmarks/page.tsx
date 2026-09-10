'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bookmark, Trash2 } from 'lucide-react';
import type { DocumentBookmarkDto } from '@tecpap/types';
import { Badge, Button } from '@tecpap/ui';
import { api, RequestError } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { EmptyState, ErrorState, PageHeader } from '@/components/admin/common';

export default function BookmarksPage() {
  const { t } = useTranslation();
  const [list, setList] = useState<DocumentBookmarkDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { setList(await api.get<DocumentBookmarkDto[]>('/bookmarks')); setError(null); }
    catch (err) { setError(err instanceof RequestError ? err.message : 'Failed.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function remove(id: string) { try { await api.delete(`/bookmarks/${id}`); await load(); } catch { /* ignore */ } }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <PageHeader title={t('doc.bookmarks')} />
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {!list ? <div className="h-16 animate-pulse rounded-md bg-muted" /> : list.length === 0 ? <EmptyState title={t('doc.no_bookmarks')} /> : (
        <ul className="flex flex-col gap-2">
          {list.map((b) => (
            <li key={b.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
              <Bookmark className="size-4 shrink-0 fill-warning-fg text-warning-fg" />
              <a href={b.href} className="min-w-0 flex-1 truncate text-sm font-medium text-foreground hover:underline">{b.label}</a>
              <Badge variant="outline" className="text-[10px] capitalize">{b.type}</Badge>
              <Button size="icon" variant="ghost" className="size-7" onClick={() => void remove(b.id)}><Trash2 className="size-3.5" /></Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
