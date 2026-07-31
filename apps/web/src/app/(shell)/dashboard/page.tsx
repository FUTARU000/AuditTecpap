'use client';

import { useAsync } from '@/lib/use-async';
import { api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import type { DashboardStatsDto } from '@tecpap/types';
import { Badge } from '@tecpap/ui';
import { PageHeader } from '@/components/admin/common';
import { FolderTree, FileText, Clock, AlertTriangle, Workflow, Building2, ClipboardCheck, Gauge } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

function StatCard({ label, value, icon: Icon, tone = 'default' }: { label: string; value: number | string; icon: LucideIcon; tone?: 'default' | 'success' | 'warning' | 'danger' }) {
  const toneClass = tone === 'success' ? 'text-status-success' : tone === 'warning' ? 'text-status-warning' : tone === 'danger' ? 'text-destructive' : 'text-primary';
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <span className={`flex size-9 items-center justify-center rounded-md bg-muted ${toneClass}`}><Icon className="size-5" /></span>
        <span className="text-2xl font-semibold text-foreground">{value}</span>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { data, loading, error, reload } = useAsync<DashboardStatsDto>(() => api.get('/dashboard/stats'));
  const { t } = useTranslation();

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <PageHeader title={t('dashboard.title', 'Dashboard')} description={t('dashboard.description', 'Quality management overview.')} />

      {error ? (
        <p className="text-sm text-destructive">{error} <button className="underline" onClick={reload}>Retry</button></p>
      ) : !data ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 7 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-lg border border-border bg-card" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label={t('dashboard.departments', 'Departments')} value={data.departments} icon={Building2} />
            <StatCard label={t('dashboard.processes', 'Processes')} value={data.processes} icon={Workflow} />
            <StatCard label={t('dashboard.documents', 'Controlled documents')} value={data.documents} icon={FolderTree} />
            <StatCard label={t('dashboard.awaiting_approval', 'Awaiting approval')} value={data.awaitingApproval} icon={Clock} tone={data.awaitingApproval > 0 ? 'warning' : 'default'} />
            <StatCard label={t('dashboard.drafts', 'Drafts')} value={data.drafts} icon={FileText} />
            <StatCard label={t('dashboard.published', 'Published')} value={data.published} icon={FileText} tone="success" />
            <StatCard label={t('dashboard.expiring', 'Expiring soon')} value={data.expiring} icon={AlertTriangle} tone={data.expiring > 0 ? 'danger' : 'default'} />
            <StatCard label={t('dashboard.total_active', 'Total active')} value={data.byStatus.reduce((sum, row) => sum + row.count, 0)} icon={FolderTree} />
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label={t('dashboard.scheduled_audits', 'Scheduled audits')} value={data.audits.scheduled} icon={ClipboardCheck} />
            <StatCard label={t('dashboard.in_progress', 'In progress')} value={data.audits.inProgress} icon={ClipboardCheck} />
            <StatCard label={t('dashboard.completed_audits', 'Completed audits')} value={data.audits.completed} icon={ClipboardCheck} tone="success" />
            <StatCard label={t('dashboard.overdue', 'Overdue')} value={data.audits.overdue} icon={AlertTriangle} tone={data.audits.overdue > 0 ? 'danger' : 'default'} />
            <StatCard label={t('dashboard.open_findings', 'Open findings')} value={data.audits.openFindings} icon={AlertTriangle} tone={data.audits.openFindings > 0 ? 'warning' : 'default'} />
            <StatCard label={t('dashboard.compliance_rate', 'Compliance rate')} value={`${data.audits.complianceRate}%`} icon={Gauge} tone="success" />
            <StatCard label={t('dashboard.completion_rate', 'Completion rate')} value={`${data.audits.completionRate}%`} icon={Gauge} />
            <StatCard label={t('dashboard.findings', 'Findings')} value={data.audits.findingsBySeverity.reduce((sum, row) => sum + row.count, 0)} icon={AlertTriangle} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-5">
              <h3 className="mb-3 text-sm font-semibold text-foreground">{t('dashboard.docs_awaiting', 'Documents awaiting approval')}</h3>
              {data.documentsAwaitingApproval.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('empty.no_data', 'No data')}</p>
              ) : (
                <ul className="space-y-2">
                  {data.documentsAwaitingApproval.map((doc) => (
                    <li key={doc.id} className="flex items-center justify-between gap-2 text-sm">
                      <a href={`/documents/${doc.id}`} className="truncate font-medium text-foreground hover:underline">{doc.title}</a>
                      <Badge variant="outline" className="font-mono text-xs">{doc.code}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-lg border border-border bg-card p-5">
              <h3 className="mb-3 text-sm font-semibold text-foreground">{t('dashboard.recent_activity', 'Recent activity')}</h3>
              {data.recentUpdates.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('empty.no_data', 'No data')}</p>
              ) : (
                <ul className="space-y-2">
                  {data.recentUpdates.map((entry) => (
                    <li key={entry.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate">
                        <span className="font-mono text-xs text-muted-foreground">{entry.action}</span>
                        {entry.target ? <span className="ml-2 text-foreground">{entry.target}</span> : null}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleDateString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
      {loading ? null : null}
    </div>
  );
}
