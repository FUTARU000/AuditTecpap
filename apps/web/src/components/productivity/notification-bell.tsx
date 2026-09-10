'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck } from 'lucide-react';
import type { NotificationDto, PaginatedResult } from '@tecpap/types';
import { cn } from '@tecpap/ui';
import { api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { resolveNotificationText } from '@/lib/notifications';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const SEVERITY_DOT: Record<string, string> = {
  INFO: 'bg-primary', SUCCESS: 'bg-success-fg', WARNING: 'bg-warning-fg', CRITICAL: 'bg-danger-fg',
};

export function NotificationBell() {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<NotificationDto[]>([]);
  const [open, setOpen] = useState(false);

  const loadCount = useCallback(async () => {
    try { const r = await api.get<{ count: number }>('/notifications/unread-count'); setCount(r.count); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    void loadCount();
    const h = setInterval(loadCount, 30_000);
    return () => clearInterval(h);
  }, [loadCount]);

  useEffect(() => {
    if (!open) return;
    api.get<PaginatedResult<NotificationDto>>('/notifications', { pageSize: '6', unread: 'true' })
      .then((r) => setItems(r.items))
      .catch(() => undefined);
  }, [open, count]);

  async function markAll() {
    try { await api.post('/notifications/read-all'); setCount(0); setItems([]); } catch { /* ignore */ }
  }

  async function markOne(id: string) {
    try { await api.post(`/notifications/${id}/read`); setItems((prev) => prev.filter((n) => n.id !== id)); setCount((c) => Math.max(0, c - 1)); } catch { /* ignore */ }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button type="button" className="relative inline-flex size-9 items-center justify-center rounded-md text-foreground/80 transition-colors hover:bg-accent" aria-label="Notifications">
          <Bell className="size-5" />
          {count > 0 ? (
            <span className="absolute right-1 top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-danger-fg px-1 text-[10px] font-semibold text-danger">
              {count > 9 ? '9+' : count}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2">
          <DropdownMenuLabel className="p-0 text-sm font-semibold">{t('productivity.notifications')}</DropdownMenuLabel>
          {count > 0 ? (
            <button type="button" onClick={() => void markAll()} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <CheckCheck className="size-3.5" /> {t('productivity.mark_all_read')}
            </button>
          ) : null}
        </div>
        <DropdownMenuSeparator className="m-0" />
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">{t('productivity.no_notifications')}</p>
          ) : items.map((n) => {
            const { title, message } = resolveNotificationText(n, locale);
            return (
              <DropdownMenuItem key={n.id} className="flex-col items-start gap-0.5 px-3 py-2" onClick={() => { if (n.actionUrl) router.push(n.actionUrl); void markOne(n.id); setOpen(false); }}>
                <div className="flex w-full items-start gap-2">
                  <span className={cn('mt-1 size-2 shrink-0 rounded-full', SEVERITY_DOT[n.severity] ?? 'bg-primary')} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-foreground">{title}</p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{message}</p>
                  </div>
                </div>
              </DropdownMenuItem>
            );
          })}
        </div>
        <DropdownMenuSeparator className="m-0" />
        <DropdownMenuItem className="justify-center text-xs" onClick={() => { setOpen(false); router.push('/notifications'); }}>
          {t('productivity.view_all')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
