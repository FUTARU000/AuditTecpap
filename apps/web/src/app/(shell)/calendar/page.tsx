'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CalendarEventDto } from '@tecpap/types';
import { Badge, Button } from '@tecpap/ui';
import { cn } from '@tecpap/ui';
import { api, RequestError } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { ErrorState, PageHeader } from '@/components/admin/common';

const TYPE_TONE: Record<string, string> = { audit: 'bg-primary', capa: 'bg-warning-fg', document: 'bg-success-fg', finding: 'bg-danger-fg', risk: 'bg-secondary-foreground' };
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function CalendarPage() {
  const { t } = useTranslation();
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [events, setEvents] = useState<CalendarEventDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  const from = cursor;
  const to = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59);

  const load = useCallback(async () => {
    try { setEvents(await api.get<CalendarEventDto[]>('/calendar', { from: from.toISOString(), to: to.toISOString() })); setError(null); } catch (err) { setError(err instanceof RequestError ? err.message : 'Failed to load.'); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor]);

  useEffect(() => { void load(); }, [load]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEventDto[]>();
    for (const e of events) { const key = e.date.slice(0, 10); if (!map.has(key)) map.set(key, []); map.get(key)!.push(e); }
    return map;
  }, [events]);

  const firstWeekday = (new Date(cursor.getFullYear(), cursor.getMonth(), 1).getDay() + 6) % 7; // Monday-based
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const todayKey = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <PageHeader title={t('productivity.calendar')} action={
        <div className="flex items-center gap-1">
          <Button size="icon" variant="outline" onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}><ChevronLeft className="size-4" /></Button>
          <span className="min-w-24 text-center text-sm font-medium capitalize">{cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
          <Button size="icon" variant="outline" onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}><ChevronRight className="size-4" /></Button>
        </div>
      } />
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="grid grid-cols-7 border-b border-border bg-muted/50">
            {DOW.map((d) => <div key={d} className="px-2 py-2 text-center text-[10px] font-medium uppercase text-muted-foreground">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: firstWeekday }).map((_, i) => <div key={`b${i}`} className="min-h-24 border-b border-r border-border bg-muted/30" />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const key = new Date(cursor.getFullYear(), cursor.getMonth(), day).toISOString().slice(0, 10);
              const dayEvents = byDay.get(key) ?? [];
              return (
                <div key={day} className={cn('min-h-24 border-b border-r border-border p-1.5', key === todayKey && 'bg-primary/5')}>
                  <div className={cn('mb-1 text-xs font-medium', key === todayKey ? 'inline-flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground' : 'text-muted-foreground')}>{day}</div>
                  <div className="flex flex-col gap-0.5">
                    {dayEvents.slice(0, 3).map((e) => (
                      <a key={e.id} href={e.href} className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] text-foreground hover:bg-accent" title={e.title}>
                        <span className={cn('size-1.5 shrink-0 rounded-full', TYPE_TONE[e.type] ?? 'bg-primary')} />
                        <span className="truncate">{e.title}</span>
                      </a>
                    ))}
                    {dayEvents.length > 3 ? <span className="px-1 text-[10px] text-muted-foreground">+{dayEvents.length - 3}</span> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <section className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-2 text-sm font-semibold">Agenda</h3>
        {events.length === 0 ? <p className="text-xs text-muted-foreground">{t('productivity.no_events')}</p> : (
          <ul className="flex flex-col gap-1.5">
            {events.slice(0, 20).map((e) => (
              <li key={e.id} className="flex items-center gap-2 text-sm">
                <Badge variant="outline" className="w-16 justify-center text-[10px] capitalize">{e.type}</Badge>
                <a href={e.href} className="flex-1 truncate text-foreground hover:underline">{e.title}</a>
                <span className="text-xs text-muted-foreground">{new Date(e.date).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
