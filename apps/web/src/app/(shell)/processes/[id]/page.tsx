'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Loader2, PlusCircle } from 'lucide-react';
import { toast } from 'sonner';
import { PROCESS_ROLE_LABELS, PROCESS_ROLES, type ProcessRole } from '@tecpap/config';
import type { PaginatedResult, ProcessWorkspaceDto, UserDto } from '@tecpap/types';
import { Badge, Button, Label } from '@tecpap/ui';
import { api, RequestError } from '@/lib/api';
import { useAsync } from '@/lib/use-async';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ErrorState } from '@/components/admin/common';
import { useTranslation } from '@/lib/i18n';

function StatCard({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className={`text-2xl font-semibold ${tone ?? 'text-foreground'}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export default function ProcessWorkspacePage() {
  const params = useParams();
  const id = params?.id as string;
  const { data, loading, error, reload } = useAsync<ProcessWorkspaceDto>(() => api.get(`/processes/${id}/workspace`));
  const { t } = useTranslation();
  const [users, setUsers] = useState<UserDto[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [assignUserId, setAssignUserId] = useState('');
  const [assignRole, setAssignRole] = useState<ProcessRole>('OPERATOR');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<PaginatedResult<UserDto>>('/users', { pageSize: 100 }).then((result) => setUsers(result.items)).catch(() => undefined);
  }, []);

  async function addAssignment() {
    if (!assignUserId) return;
    setSaving(true);
    try {
      await api.post(`/processes/${id}/assignments`, { userId: assignUserId, role: assignRole });
      toast.success('Responsibility added');
      setDialogOpen(false);
      setAssignUserId('');
      await reload();
    } catch (err) {
      toast.error(err instanceof RequestError ? err.message : 'Could not add responsibility.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="mx-auto max-w-6xl p-8 text-sm text-muted-foreground">{t('misc.loading_workspace')}</div>;
  if (error || !data) return <div className="mx-auto max-w-5xl"><ErrorState message={error ?? 'Process not found'} /></div>;

  const { process, objectives, scope, ownerName, kpis, risks, assignments, documents, businessObjects, timeline, stats } = data;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/processes" className="text-xs text-muted-foreground hover:underline">← {t('page.processes')}</Link>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">{process.name}</h2>
              <Badge variant={process.status === 'ACTIVE' ? 'success' : 'secondary'}>{process.status}</Badge>
            </div>
            <p className="font-mono text-sm text-muted-foreground">{process.code} · {process.departmentName} · Owner: {ownerName ?? '—'}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t('page.documents')} value={stats.documents} />
        <StatCard label={t('workspace.business_objects')} value={stats.businessObjects} />
        <StatCard label={t('workspace.kpis')} value={stats.kpis} />
        <StatCard label={t('dashboard.open_findings')} value={stats.openRisks} tone={stats.openRisks > 0 ? 'text-destructive' : undefined} />
      </div>

      {/* Overview */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="mb-2 text-sm font-semibold text-foreground">{t('workspace.objectives')}</h3>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{objectives || t('workspace.no_objectives')}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="mb-2 text-sm font-semibold text-foreground">{t('workspace.scope')}</h3>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{scope || t('workspace.no_scope')}</p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-6">
          {/* KPIs */}
          <section className="rounded-lg border border-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">{t('workspace.kpis')}</h3>
              <Link href="/kpis" className="text-xs text-muted-foreground hover:underline">{t('workspace.manage')}</Link>
            </div>
            {kpis.length === 0 ? <p className="text-sm text-muted-foreground">{t('empty.no_kpis')}</p> : (
              <div className="grid gap-3 sm:grid-cols-2">
                {kpis.map((kpi) => (
                  <div key={kpi.id} className="rounded-md border border-border p-3">
                    <p className="text-sm font-medium text-foreground">{kpi.name}</p>
                    <p className="text-lg font-semibold text-foreground">{kpi.currentValue !== null ? `${kpi.currentValue}${kpi.unit ?? ''}` : '—'}<span className="ml-2 text-xs font-normal text-muted-foreground">/ {kpi.target !== null ? `${kpi.target}${kpi.unit ?? ''}` : '—'}</span></p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Risks */}
          <section className="rounded-lg border border-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">{t('workspace.current_risks')}</h3>
              <Link href="/risks" className="text-xs text-muted-foreground hover:underline">{t('workspace.manage')}</Link>
            </div>
            {risks.length === 0 ? <p className="text-sm text-muted-foreground">{t('empty.no_risks')}</p> : (
              <ul className="space-y-2">
                {risks.map((risk) => (
                  <li key={risk.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-3 text-sm">
                    <div>
                      <p className="font-medium text-foreground">{risk.title}</p>
                      <p className="text-xs text-muted-foreground">P{risk.probability} × I{risk.impact}</p>
                    </div>
                    <Badge variant={risk.riskScore >= 15 ? 'danger' : risk.riskScore >= 8 ? 'warning' : 'secondary'}>Score {risk.riskScore}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Business objects */}
          <section className="rounded-lg border border-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">{t('workspace.business_objects')}</h3>
              <Link href="/business-objects" className="text-xs text-muted-foreground hover:underline">{t('workspace.manage')}</Link>
            </div>
            {businessObjects.length === 0 ? <p className="text-sm text-muted-foreground">{t('empty.no_business_objects')}</p> : (
              <ul className="divide-y divide-border">
                {businessObjects.map((object) => (
                  <li key={object.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <Link href={`/business-objects/${object.id}`} className="font-medium text-foreground hover:underline">{object.name}</Link>
                    <span className="text-xs text-muted-foreground">{object.typeName}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Documents */}
          <section className="rounded-lg border border-border bg-card p-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground">{t('workspace.related_documents')}</h3>
            {documents.length === 0 ? <p className="text-sm text-muted-foreground">{t('empty.no_documents_here')}</p> : (
              <ul className="divide-y divide-border">
                {documents.map((document) => (
                  <li key={document.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <Link href={`/documents/${document.id}`} className="font-medium text-foreground hover:underline">{document.title}</Link>
                    <Badge variant="outline" className="font-mono text-xs">{document.code}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Side column */}
        <div className="flex flex-col gap-6">
          {/* Assignments */}
          <section className="rounded-lg border border-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">{t('workspace.responsibilities')}</h3>
              <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}><PlusCircle className="size-4" /> {t('button.add_responsibility')}</Button>
            </div>
            {assignments.length === 0 ? <p className="text-sm text-muted-foreground">{t('empty.no_data')}</p> : (
              <ul className="space-y-2 text-sm">
                {assignments.map((assignment) => (
                  <li key={assignment.id} className="flex items-center justify-between gap-2">
                    <span className="text-foreground">{assignment.userName}</span>
                    <Badge variant="outline">{PROCESS_ROLE_LABELS[assignment.role as ProcessRole] ?? assignment.role}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Timeline */}
          <section className="rounded-lg border border-border bg-card p-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground">{t('workspace.recent_activity')}</h3>
            {timeline.length === 0 ? <p className="text-sm text-muted-foreground">{t('empty.no_data')}</p> : (
              <ul className="space-y-2 text-sm">
                {timeline.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-2">
                    <span className="truncate"><span className="font-mono text-xs text-muted-foreground">{entry.eventType}</span><span className="ml-1 text-foreground">{entry.title}</span></span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('dialog.add_responsibility')}</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label>{t('page.users')}</Label>
              <Select value={assignUserId} onValueChange={setAssignUserId}>
                <SelectTrigger><SelectValue placeholder={t('misc.select_user')} /></SelectTrigger>
                <SelectContent>{users.map((user) => <SelectItem key={user.id} value={user.id}>{user.firstName} {user.lastName} — {user.email}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Role</Label>
              <Select value={assignRole} onValueChange={(value) => setAssignRole(value as ProcessRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PROCESS_ROLES.map((role) => <SelectItem key={role} value={role}>{PROCESS_ROLE_LABELS[role]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => void addAssignment()} disabled={saving || !assignUserId}>{saving ? <Loader2 className="size-4 animate-spin" /> : null}Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
