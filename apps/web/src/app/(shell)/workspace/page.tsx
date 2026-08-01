'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { WorkspaceDto } from '@tecpap/types';
import { Badge } from '@tecpap/ui';
import { api, RequestError } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { ErrorState, PageHeader } from '@/components/admin/common';

export default function WorkspacePage() {
  const { t } = useTranslation();
  const [data, setData] = useState<WorkspaceDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setData(await api.get<WorkspaceDto>('/workspace')); setError(null); } catch (err) { setError(err instanceof RequestError ? err.message : 'Failed to load.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (error) return <div className="mx-auto max-w-6xl"><ErrorState message={error} onRetry={() => void load()} /></div>;
  if (!data) return <div className="mx-auto max-w-6xl p-8 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <PageHeader title={t('productivity.workspace')} description={data.departmentName ?? undefined} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t('productivity.unread')} value={data.unreadNotifications} tone="text-primary-fg" />
        <Stat label={t('productivity.open_tasks')} value={data.openTasks} tone="text-warning-fg" />
        <Stat label={t('productivity.pending_approvals')} value={data.pendingApprovals.length} />
        <Stat label={t('productivity.my_capas')} value={data.capas.length} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t('productivity.upcoming_deadlines')}>
          {data.upcomingDeadlines.length === 0 ? <Muted>—</Muted> : data.upcomingDeadlines.map((d) => (
            <Row key={d.href + d.date} href={d.href} title={d.title} sub={<Badge variant="outline" className="text-[10px]">{d.type}</Badge>} right={new Date(d.date).toLocaleDateString()} />
          ))}
        </Panel>
        <Panel title={t('productivity.my_audits')}>
          {data.audits.length === 0 ? <Muted>—</Muted> : data.audits.map((a) => <Row key={a.id} href={a.href} title={a.title} sub={<Badge variant="outline" className="text-[10px]">{a.status}</Badge>} right={a.scheduledDate ? new Date(a.scheduledDate).toLocaleDateString() : ''} />)}
        </Panel>
        <Panel title={t('productivity.my_capas')}>
          {data.capas.length === 0 ? <Muted>—</Muted> : data.capas.map((c) => <Row key={c.id} href={c.href} title={c.title} sub={<Badge variant="outline" className="text-[10px]">{c.status}</Badge>} right={c.targetDate ? new Date(c.targetDate).toLocaleDateString() : ''} />)}
        </Panel>
        <Panel title={t('productivity.pending_approvals')}>
          {data.pendingApprovals.length === 0 ? <Muted>—</Muted> : data.pendingApprovals.map((d) => <Row key={d.id} href={d.href} title={`${d.code} — ${d.title}`} sub={<Badge variant="outline" className="text-[10px]">{d.status}</Badge>} />)}
        </Panel>
        <Panel title={t('productivity.my_findings')}>
          {data.findings.length === 0 ? <Muted>—</Muted> : data.findings.map((f) => <Row key={f.id} href={f.href} title={f.title} sub={<Badge variant="warning" className="text-[10px]">{f.severity}</Badge>} />)}
        </Panel>
        <Panel title={t('productivity.my_imports')}>
          {data.imports.length === 0 ? <Muted>—</Muted> : data.imports.map((i) => <Row key={i.id} href={i.href} title={i.name} sub={<Badge variant="outline" className="text-[10px]">{i.pending} review</Badge>} />)}
        </Panel>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) { return <div className="rounded-lg border border-border bg-card p-4"><div className={`text-2xl font-semibold ${tone ?? ''}`}>{value}</div><div className="text-xs text-muted-foreground">{label}</div></div>; }
function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-lg border border-border bg-card p-4"><h3 className="mb-2 text-sm font-semibold text-foreground">{title}</h3><div className="flex flex-col gap-1.5">{children}</div></section>; }
function Muted({ children }: { children: React.ReactNode }) { return <p className="text-xs text-muted-foreground">{children}</p>; }
function Row({ href, title, sub, right }: { href: string; title: string; sub?: React.ReactNode; right?: string }) { return <Link href={href} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"><span className="min-w-0 flex-1 truncate text-foreground">{title}</span>{sub}{right ? <span className="text-xs text-muted-foreground">{right}</span> : null}</Link>; }
