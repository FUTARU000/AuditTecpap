'use client';

import { useCallback, useEffect, useState } from 'react';
import { Archive, CheckCheck, Trash2 } from 'lucide-react';
import type { NotificationDto, PaginatedResult } from '@tecpap/types';
import { Badge, Button } from '@tecpap/ui';
import { cn } from '@tecpap/ui';
import { api, RequestError } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { EmptyState, ErrorState, PageHeader } from '@/components/admin/common';

type Tab = 'all' | 'unread' | 'archived';
const SEVERITY: Record<string, 'secondary' | 'success' | 'warning' | 'danger'> = { INFO: 'secondary', SUCCESS: 'success', WARNING: 'warning', CRITICAL: 'danger' };

export default function NotificationsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('unread');
  const [data, setData] = useState<PaginatedResult<NotificationDto> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params: Record<string, string> = { pageSize: '50' };
      if (tab === 'unread') params.unread = 'true';
      if (tab === 'archived') params.archived = 'true';
      setData(await api.get<PaginatedResult<NotificationDto>>('/notifications', params));
    } catch (err) { setError(err instanceof RequestError ? err.message : 'Failed to load.'); }
    finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { void load(); }, [load]);

  async function act(id: string, action: 'read' | 'archive' | 'delete') {
    try {
      if (action === 'read') await api.post(`/notifications/${id}/read`);
      if (action === 'archive') await api.post(`/notifications/${id}/archive`);
      if (action === 'delete') await api.delete(`/notifications/${id}`);
      await load();
    } catch { /* ignore */ }
  }

  async function markAll() {
    try { await api.post('/notifications/read-all'); await load(); } catch { /* ignore */ }
  }

  const items = data?.items ?? [];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <PageHeader title={t('productivity.notifications')} action={tab === 'unread' && items.length > 0 ? <Button size="sm" variant="outline" onClick={() => void markAll()}><CheckCheck className="size-4" /> {t('productivity.mark_all_read')}</Button> : undefined} />
      <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
        {(['unread', 'all', 'archived'] as Tab[]).map((tb) => (
          <button key={tb} type="button" onClick={() => setTab(tb)} className={cn('flex-1 rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors', tab === tb ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
            {tb === 'unread' ? t('productivity.unread') : tb}
          </button>
        ))}
      </div>
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-md bg-muted" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState title={t('productivity.no_notifications')} />
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((n) => (
            <li key={n.id} className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
              <Badge variant={SEVERITY[n.severity] ?? 'secondary'} className="mt-0.5 shrink-0 text-[10px] uppercase">{n.severity}</Badge>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{n.title}</p>
                <p className="text-xs text-muted-foreground">{n.message}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                {!n.readAt && tab !== 'archived' ? <Button size="icon" variant="ghost" className="size-7" onClick={() => void act(n.id, 'read')} aria-label="Read"><CheckCheck className="size-3.5" /></Button> : null}
                {tab !== 'archived' ? <Button size="icon" variant="ghost" className="size-7" onClick={() => void act(n.id, 'archive')} aria-label="Archive"><Archive className="size-3.5" /></Button> : null}
                <Button size="icon" variant="ghost" className="size-7" onClick={() => void act(n.id, 'delete')} aria-label="Delete"><Trash2 className="size-3.5" /></Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
