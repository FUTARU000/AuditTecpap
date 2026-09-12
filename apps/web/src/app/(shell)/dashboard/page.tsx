'use client';

import Link from 'next/link';
import { useAsync } from '@/lib/use-async';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useTranslation } from '@/lib/i18n';
import type { DashboardAttentionItemDto, DashboardStatsDto } from '@tecpap/types';
import { Badge } from '@tecpap/ui';
import { PageHeader } from '@/components/admin/common';
import {
  FolderTree,
  FileText,
  Clock,
  AlertTriangle,
  Building2,
  ClipboardCheck,
  Gauge,
  Upload,
  CheckCircle2,
  ClipboardList,
  PlayCircle,
  Wrench,
  XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/** A fresh platform: no documents and no audit activity yet — show onboarding. */
function isFresh(data: DashboardStatsDto): boolean {
  return (
    data.overview.activeDocuments === 0 &&
    data.audits.scheduled === 0 &&
    data.audits.inProgress === 0 &&
    data.audits.completed === 0
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'default',
  href,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone?: 'default' | 'success' | 'warning' | 'danger';
  href?: string;
}) {
  const toneClass =
    tone === 'success'
      ? 'text-status-success'
      : tone === 'warning'
        ? 'text-status-warning'
        : tone === 'danger'
          ? 'text-destructive'
          : 'text-primary';
  const body = (
    <div className="border-border bg-card hover:border-primary/40 rounded-lg border p-5 transition-colors">
      <div className="flex items-center justify-between">
        <span
          className={`bg-muted flex size-9 items-center justify-center rounded-md ${toneClass}`}
        >
          <Icon className="size-5" />
        </span>
        <span className="text-foreground text-2xl font-semibold">{value}</span>
      </div>
      <p className="text-muted-foreground mt-3 text-sm">{label}</p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-muted-foreground text-sm font-semibold uppercase tracking-wide">
      {children}
    </h3>
  );
}

const ATTENTION_ICON: Record<DashboardAttentionItemDto['type'], LucideIcon> = {
  CRITICAL_INDICATOR: Gauge,
  OVERDUE_AUDIT: ClipboardCheck,
  OVERDUE_CAPA: Wrench,
  DOCUMENT_AWAITING_APPROVAL: Clock,
  RETURNED_CAPA: XCircle,
};

export default function DashboardPage() {
  const { data, error, reload } = useAsync<DashboardStatsDto>(() => api.get('/dashboard/stats'));
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const isManager = hasPermission('capas.verify');
  const isPilot = !isManager && hasPermission('capas.submit');

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <PageHeader
        title={t('dashboard.title', 'Dashboard')}
        description={t('dashboard.description', 'Quality management overview.')}
      />

      {error ? (
        <p className="text-destructive text-sm">
          {error}{' '}
          <button className="underline" onClick={reload}>
            Retry
          </button>
        </p>
      ) : !data ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="border-border bg-card h-28 animate-pulse rounded-lg border" />
          ))}
        </div>
      ) : (
        <>
          {isFresh(data) ? (
            <section className="border-primary/30 bg-primary/5 rounded-lg border p-6">
              <h2 className="text-foreground text-lg font-semibold">{t('onboarding.title')}</h2>
              <p className="text-muted-foreground mt-1 text-sm">{t('onboarding.subtitle')}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    icon: Upload,
                    title: t('onboarding.step1'),
                    desc: t('onboarding.step1_desc'),
                    href: '/import',
                  },
                  {
                    icon: CheckCircle2,
                    title: t('onboarding.step2'),
                    desc: t('onboarding.step2_desc'),
                    href: '/documents',
                  },
                  {
                    icon: ClipboardList,
                    title: t('onboarding.step4'),
                    desc: t('onboarding.step4_desc'),
                    href: '/audit-templates',
                  },
                  {
                    icon: PlayCircle,
                    title: t('onboarding.step5'),
                    desc: t('onboarding.step5_desc'),
                    href: '/audits',
                  },
                ].map((step, i) => (
                  <Link
                    key={step.href}
                    href={step.href}
                    className="border-border bg-background hover:border-primary group rounded-lg border p-4 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="bg-muted text-muted-foreground flex size-7 items-center justify-center rounded-md text-xs font-semibold">
                        {i + 1}
                      </span>
                      <step.icon className="text-primary size-4" />
                    </div>
                    <p className="text-foreground mt-2 text-sm font-medium">{step.title}</p>
                    <p className="text-muted-foreground mt-0.5 text-xs">{step.desc}</p>
                  </Link>
                ))}
              </div>
              <Link
                href="/import"
                className="bg-primary text-primary-foreground hover:bg-primary/90 mt-5 inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium"
              >
                <Upload className="size-4" /> {t('onboarding.import_cta')}
              </Link>
            </section>
          ) : null}

          {/* A — Overview: one high-level number per active module. */}
          <section className="flex flex-col gap-3">
            <SectionTitle>{t('dashboard.section_overview')}</SectionTitle>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
              <StatCard
                label={t('dashboard.departments', 'Departments')}
                value={data.overview.departments}
                icon={Building2}
              />
              <StatCard
                label={t('dashboard.active_documents')}
                value={data.overview.activeDocuments}
                icon={FolderTree}
                href="/documents"
              />
              <StatCard
                label={t('dashboard.indicators_active')}
                value={data.overview.activeIndicators}
                icon={Gauge}
                href="/indicators"
              />
              <StatCard
                label={t('dashboard.open_findings')}
                value={data.overview.openFindings}
                icon={AlertTriangle}
                tone={data.overview.openFindings > 0 ? 'warning' : 'default'}
                href="/audits"
              />
              <StatCard
                label={t('dashboard.open_capas')}
                value={data.overview.openCapas}
                icon={Wrench}
                href="/capas"
              />
              <StatCard
                label={t('dashboard.audits_in_progress')}
                value={data.overview.auditsInProgress}
                icon={ClipboardCheck}
                href="/audits"
              />
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* B — Document control */}
            <section className="flex flex-col gap-3">
              <SectionTitle>{t('dashboard.section_documents')}</SectionTitle>
              <div className="grid grid-cols-2 gap-4">
                <StatCard
                  label={t('dashboard.total_active', 'Total active')}
                  value={data.documents.totalActive}
                  icon={FolderTree}
                  href="/documents"
                />
                <StatCard
                  label={t('dashboard.awaiting_approval', 'Awaiting approval')}
                  value={data.documents.awaitingApproval}
                  icon={Clock}
                  tone={data.documents.awaitingApproval > 0 ? 'warning' : 'default'}
                  href="/documents?status=UNDER_REVIEW"
                />
                <StatCard
                  label={t('dashboard.drafts', 'Drafts')}
                  value={data.documents.drafts}
                  icon={FileText}
                  href="/documents?status=DRAFT"
                />
                <StatCard
                  label={t('dashboard.expiring', 'Expiring soon')}
                  value={data.documents.expiringSoon}
                  icon={AlertTriangle}
                  tone={data.documents.expiringSoon > 0 ? 'danger' : 'default'}
                  href="/documents?expiry=EXPIRING_SOON"
                />
              </div>
            </section>

            {/* D — CAPA summary */}
            <section className="flex flex-col gap-3">
              <SectionTitle>{t('dashboard.section_capa')}</SectionTitle>
              <div className="grid grid-cols-2 gap-4">
                <StatCard
                  label={t('dashboard.open_capas')}
                  value={data.capas.open}
                  icon={Wrench}
                  href="/capas"
                />
                <StatCard
                  label={t('dashboard.capa_awaiting_verification')}
                  value={data.capas.awaitingVerification}
                  icon={ClipboardCheck}
                  tone={data.capas.awaitingVerification > 0 ? 'warning' : 'default'}
                  href="/capas"
                />
                <StatCard
                  label={t('dashboard.capa_returned')}
                  value={data.capas.returned}
                  icon={XCircle}
                  tone={data.capas.returned > 0 ? 'danger' : 'default'}
                  href="/capas"
                />
                <StatCard
                  label={t('dashboard.capa_validated')}
                  value={data.capas.validated}
                  icon={CheckCircle2}
                  tone="success"
                  href="/capas"
                />
              </div>
            </section>
          </div>

          {/* C — Audit programme */}
          <section className="flex flex-col gap-3">
            <SectionTitle>{t('dashboard.section_audits')}</SectionTitle>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard
                label={t('dashboard.scheduled_audits', 'Scheduled audits')}
                value={data.audits.scheduled}
                icon={ClipboardCheck}
                href="/audits"
              />
              <StatCard
                label={t('dashboard.in_progress', 'In progress')}
                value={data.audits.inProgress}
                icon={ClipboardCheck}
                href="/audits"
              />
              <StatCard
                label={t('dashboard.completed_audits', 'Completed audits')}
                value={data.audits.completed}
                icon={ClipboardCheck}
                tone="success"
                href="/audits"
              />
              <StatCard
                label={t('dashboard.overdue', 'Overdue')}
                value={data.audits.overdue}
                icon={AlertTriangle}
                tone={data.audits.overdue > 0 ? 'danger' : 'default'}
                href="/audits"
              />
              <StatCard
                label={t('dashboard.compliance_rate', 'Compliance rate')}
                value={`${data.audits.complianceRate}%`}
                icon={Gauge}
                tone="success"
              />
              <StatCard
                label={t('dashboard.completion_rate', 'Completion rate')}
                value={`${data.audits.completionRate}%`}
                icon={Gauge}
              />
            </div>
          </section>

          {/* E — Indicators */}
          <section className="flex flex-col gap-3">
            <SectionTitle>{t('dashboard.section_indicators')}</SectionTitle>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard
                label={t('dashboard.indicators_active')}
                value={data.indicators.active}
                icon={Gauge}
                href="/indicators"
              />
              <StatCard
                label={t('dashboard.indicators_on_target')}
                value={data.indicators.onTarget}
                icon={CheckCircle2}
                tone="success"
                href="/indicators"
              />
              <StatCard
                label={t('dashboard.indicators_warning')}
                value={data.indicators.warning}
                icon={AlertTriangle}
                tone={data.indicators.warning > 0 ? 'warning' : 'default'}
                href="/indicators"
              />
              <StatCard
                label={t('dashboard.indicators_critical')}
                value={data.indicators.critical}
                icon={AlertTriangle}
                tone={data.indicators.critical > 0 ? 'danger' : 'default'}
                href="/indicators"
              />
            </div>
          </section>

          {/* F — Recent activity / action required */}
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="border-border bg-card rounded-lg border p-5">
              <h3 className="text-foreground mb-3 text-sm font-semibold">
                {t('dashboard.section_attention')}
              </h3>
              {data.requiresAttention.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t('dashboard.no_attention')}</p>
              ) : (
                <ul className="space-y-2">
                  {data.requiresAttention.map((item) => {
                    const Icon = ATTENTION_ICON[item.type];
                    return (
                      <li key={`${item.type}:${item.id}`}>
                        <Link
                          href={item.href}
                          className="flex items-center gap-2 text-sm hover:underline"
                        >
                          <Icon className="text-muted-foreground size-3.5 shrink-0" />
                          <span className="text-foreground min-w-0 flex-1 truncate">
                            {item.title}
                          </span>
                          {item.detail ? (
                            <span className="text-muted-foreground shrink-0 text-xs">
                              {item.detail}
                            </span>
                          ) : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="border-border bg-card rounded-lg border p-5">
              <h3 className="text-foreground mb-3 text-sm font-semibold">
                {t('dashboard.docs_awaiting', 'Documents awaiting approval')}
              </h3>
              {data.documentsAwaitingApproval.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t('empty.no_data', 'No data')}</p>
              ) : (
                <ul className="space-y-2">
                  {data.documentsAwaitingApproval.map((doc) => (
                    <li key={doc.id} className="flex items-center justify-between gap-2 text-sm">
                      <Link
                        href={`/documents/${doc.id}`}
                        className="text-foreground truncate font-medium hover:underline"
                      >
                        {doc.title}
                      </Link>
                      <Badge variant="outline" className="font-mono text-xs">
                        {doc.code}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-border bg-card rounded-lg border p-5">
              <h3 className="text-foreground mb-3 text-sm font-semibold">
                {t('dashboard.upcoming_audits')}
              </h3>
              {data.upcomingAudits.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t('dashboard.no_upcoming_audits')}</p>
              ) : (
                <ul className="space-y-2">
                  {data.upcomingAudits.map((audit) => (
                    <li key={audit.id} className="flex items-center justify-between gap-2 text-sm">
                      <Link
                        href={`/audits/${audit.id}`}
                        className="text-foreground truncate font-medium hover:underline"
                      >
                        {audit.title}
                      </Link>
                      <span className="text-muted-foreground shrink-0 text-xs">
                        {audit.scheduledDate
                          ? new Date(audit.scheduledDate).toLocaleDateString()
                          : '—'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="border-border bg-card rounded-lg border p-5">
            <h3 className="text-foreground mb-3 text-sm font-semibold">
              {t('dashboard.recent_activity', 'Recent activity')}
            </h3>
            {data.recentUpdates.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t('empty.no_data', 'No data')}</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {data.recentUpdates.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">
                      <span className="text-muted-foreground font-mono text-xs">
                        {entry.action}
                      </span>
                      {entry.target ? (
                        <span className="text-foreground ml-2">{entry.target}</span>
                      ) : null}
                    </span>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Phase 7.7 — TECPAP role-scoped CAPA workflow panels (personal "my work" view, distinct from the general CAPA summary above) */}
          {isManager && (data.capasToVerify || data.capasToValidate || data.capasReturned) ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard
                label={t('capa.capas_to_verify', 'CAPAs to Verify')}
                value={data.capasToVerify ?? 0}
                icon={ClipboardCheck}
                tone="warning"
                href="/capas"
              />
              <StatCard
                label={t('capa.capas_to_validate', 'CAPAs to Validate')}
                value={data.capasToValidate ?? 0}
                icon={CheckCircle2}
                tone="default"
                href="/capas"
              />
              <StatCard
                label={t('capa.returned_capas', 'Returned CAPAs')}
                value={data.capasReturned ?? 0}
                icon={AlertTriangle}
                tone="danger"
                href="/capas"
              />
            </div>
          ) : null}

          {isPilot &&
          (data.myActionsPending !== undefined || data.myReturnedCapas !== undefined) ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <StatCard
                label={t('capa.my_actions', 'My Required Actions')}
                value={data.myActionsPending ?? 0}
                icon={ClipboardCheck}
                tone="warning"
                href="/capas"
              />
              <StatCard
                label={t('capa.returned_capas', 'Returned CAPAs')}
                value={data.myReturnedCapas ?? 0}
                icon={AlertTriangle}
                tone="danger"
                href="/capas"
              />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
