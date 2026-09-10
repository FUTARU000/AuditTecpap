'use client';

import Link from 'next/link';
import { useAsync } from '@/lib/use-async';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useTranslation } from '@/lib/i18n';
import type { DashboardStatsDto } from '@tecpap/types';
import { Badge } from '@tecpap/ui';
import { PageHeader } from '@/components/admin/common';
import { FolderTree, FileText, Clock, AlertTriangle, Building2, ClipboardCheck, Gauge, Upload, CheckCircle2, ClipboardList, PlayCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/** A fresh platform: no documents and no audit activity yet — show onboarding. */
function isFresh(data: DashboardStatsDto): boolean {
  return data.documents === 0 && data.audits.scheduled === 0 && data.audits.inProgress === 0 && data.audits.completed === 0;
}

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
  const { data, error, reload } = useAsync<DashboardStatsDto>(() => api.get('/dashboard/stats'));
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const isManager = hasPermission('capas.verify');
  const isPilot = !isManager && hasPermission('capas.submit');

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
          {isFresh(data) ? (
            <section className="rounded-lg border border-primary/30 bg-primary/5 p-6">
              <h2 className="text-lg font-semibold text-foreground">{t('onboarding.title')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t('onboarding.subtitle')}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { icon: Upload, title: t('onboarding.step1'), desc: t('onboarding.step1_desc'), href: '/import' },
                  { icon: CheckCircle2, title: t('onboarding.step2'), desc: t('onboarding.step2_desc'), href: '/documents' },
                  { icon: ClipboardList, title: t('onboarding.step4'), desc: t('onboarding.step4_desc'), href: '/audit-templates' },
                  { icon: PlayCircle, title: t('onboarding.step5'), desc: t('onboarding.step5_desc'), href: '/audits' },
                ].map((step, i) => (
                  <Link key={step.href} href={step.href} className="group rounded-lg border border-border bg-background p-4 transition-colors hover:border-primary">
                    <div className="flex items-center gap-2"><span className="flex size-7 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">{i + 1}</span><step.icon className="size-4 text-primary" /></div>
                    <p className="mt-2 text-sm font-medium text-foreground">{step.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{step.desc}</p>
                  </Link>
                ))}
              </div>
              <Link href="/import" className="mt-5 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"><Upload className="size-4" /> {t('onboarding.import_cta')}</Link>
            </section>
          ) : null}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label={t('dashboard.departments', 'Departments')} value={data.departments} icon={Building2} />
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

          {/* Phase 7.7 — TECPAP role-scoped CAPA workflow panels */}
          {isManager && (data.capasToVerify || data.capasToValidate || data.capasReturned) ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard label={t('capa.capas_to_verify', 'CAPAs to Verify')} value={data.capasToVerify ?? 0} icon={ClipboardCheck} tone="warning" />
              <StatCard label={t('capa.capas_to_validate', 'CAPAs to Validate')} value={data.capasToValidate ?? 0} icon={CheckCircle2} tone="default" />
              <StatCard label={t('capa.returned_capas', 'Returned CAPAs')} value={data.capasReturned ?? 0} icon={AlertTriangle} tone="danger" />
            </div>
          ) : null}

          {isPilot && (data.myActionsPending !== undefined || data.myReturnedCapas !== undefined) ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <StatCard label={t('capa.my_actions', 'My Required Actions')} value={data.myActionsPending ?? 0} icon={ClipboardCheck} tone="warning" />
              <StatCard label={t('capa.returned_capas', 'Returned CAPAs')} value={data.myReturnedCapas ?? 0} icon={AlertTriangle} tone="danger" />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
