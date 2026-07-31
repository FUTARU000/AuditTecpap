'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, PlusCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { AuditDto, AuditTemplateDto, DepartmentDto, PaginatedResult, ProcessDto, UserDto } from '@tecpap/types';
import { Badge, Button, Input, Label } from '@tecpap/ui';
import { api, RequestError } from '@/lib/api';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState, ErrorState, PageHeader } from '@/components/admin/common';
import { useTranslation } from '@/lib/i18n';

const STATUS_TONE: Record<string, 'secondary' | 'warning' | 'success' | 'danger' | 'outline'> = {
  PLANNED: 'secondary', IN_PROGRESS: 'warning', SUBMITTED: 'outline', UNDER_REVIEW: 'outline', RETURNED: 'danger', APPROVED: 'success', COMPLETED: 'success',
};

export default function AuditsPage() {
  const [audits, setAudits] = useState<PaginatedResult<AuditDto> | null>(null);
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<AuditTemplateDto[]>([]);
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [processes, setProcesses] = useState<ProcessDto[]>([]);
  const [users, setUsers] = useState<UserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', templateId: '', departmentId: '', processId: '', auditorId: '', scheduledDate: '' });
  const [saving, setSaving] = useState(false);

  const fetchAudits = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAudits(await api.get<PaginatedResult<AuditDto>>('/audits', { pageSize: 50 }));
    } catch (err) {
      setError(err instanceof RequestError ? err.message : 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAudits();
    api.get<PaginatedResult<AuditTemplateDto>>('/audit-templates', { pageSize: 100, status: 'PUBLISHED' as never }).then((r) => setTemplates(r.items.filter((t) => t.status === 'PUBLISHED'))).catch(() => undefined);
    api.get<PaginatedResult<DepartmentDto>>('/departments', { pageSize: 100 }).then((r) => setDepartments(r.items)).catch(() => undefined);
    api.get<PaginatedResult<ProcessDto>>('/processes', { pageSize: 100 }).then((r) => setProcesses(r.items)).catch(() => undefined);
    api.get<PaginatedResult<UserDto>>('/users', { pageSize: 100 }).then((r) => setUsers(r.items)).catch(() => undefined);
  }, [fetchAudits]);

  async function save() {
    setSaving(true);
    try {
      await api.post('/audits', { title: form.title, templateId: form.templateId, departmentId: form.departmentId, processId: form.processId || null, auditorId: form.auditorId || null, scheduledDate: form.scheduledDate || null });
      toast.success('Audit scheduled');
      setOpen(false);
      await fetchAudits();
    } catch (err) {
      toast.error(err instanceof RequestError ? err.message : 'Could not create audit.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <PageHeader title={t('audit.audits_title', 'Audits')} description={t('audit.audits_desc')} action={<Button onClick={() => setOpen(true)}><PlusCircle className="size-4" /> New audit</Button>} />

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {error ? <ErrorState message={error} onRetry={() => void fetchAudits()} /> : loading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-md bg-muted" />)}</div>
        ) : !audits || audits.items.length === 0 ? <EmptyState title={t('empty.no_audits', 'No audits')} description="Schedule an audit from a published template." /> : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Audit</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Department</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Progress</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Compliance</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {audits.items.map((audit) => (
                <tr key={audit.id} className="hover:bg-accent/40">
                  <td className="px-4 py-3"><Link href={`/audits/${audit.id}`} className="font-medium text-foreground hover:underline">{audit.title}</Link><div className="text-xs text-muted-foreground">{audit.templateName}</div></td>
                  <td className="px-4 py-3 text-muted-foreground">{audit.departmentName ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{audit.progress}%</td>
                  <td className="px-4 py-3 font-medium text-foreground">{audit.compliance !== null ? `${audit.compliance}%` : '—'}</td>
                  <td className="px-4 py-3"><Badge variant={STATUS_TONE[audit.status] ?? 'secondary'}>{audit.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Schedule an audit</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2 sm:col-span-2"><Label htmlFor="a-title">Title</Label><Input id="a-title" value={form.title} onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))} /></div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label>Template</Label>
              <Select value={form.templateId} onValueChange={(v) => setForm((c) => ({ ...c, templateId: v }))}><SelectTrigger><SelectValue placeholder="Select a published template" /></SelectTrigger><SelectContent>{templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Department</Label>
              <Select value={form.departmentId} onValueChange={(v) => setForm((c) => ({ ...c, departmentId: v }))}><SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger><SelectContent>{departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Process (optional)</Label>
              <Select value={form.processId || '__none__'} onValueChange={(v) => setForm((c) => ({ ...c, processId: v === '__none__' ? '' : v }))}><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger><SelectContent><SelectItem value="__none__">—</SelectItem>{processes.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Auditor</Label>
              <Select value={form.auditorId || '__none__'} onValueChange={(v) => setForm((c) => ({ ...c, auditorId: v === '__none__' ? '' : v }))}><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger><SelectContent><SelectItem value="__none__">—</SelectItem>{users.map((u) => <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="flex flex-col gap-2"><Label htmlFor="a-date">Scheduled date</Label><Input id="a-date" type="date" value={form.scheduledDate} onChange={(e) => setForm((c) => ({ ...c, scheduledDate: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => void save()} disabled={saving || !form.title || !form.templateId || !form.departmentId}>{saving ? <Loader2 className="size-4 animate-spin" /> : null}Schedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
