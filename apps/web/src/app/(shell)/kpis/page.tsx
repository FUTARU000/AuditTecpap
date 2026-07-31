'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, PlusCircle } from 'lucide-react';
import { toast } from 'sonner';
import { KPI_FREQUENCIES } from '@tecpap/config';
import type { DepartmentDto, KpiDto, PaginatedResult, ProcessDto, UserDto } from '@tecpap/types';
import { Badge, Button, Input, Label } from '@tecpap/ui';
import { api, RequestError } from '@/lib/api';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState, ErrorState, PageHeader } from '@/components/admin/common';
import { useTranslation } from '@/lib/i18n';

type Form = { name: string; target: string; unit: string; warning: string; critical: string; frequency: string; responsibleId: string; departmentId: string; processId: string };

export default function KpisPage() {
  const [kpis, setKpis] = useState<KpiDto[]>([]);
  const { t } = useTranslation();
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [processes, setProcesses] = useState<ProcessDto[]>([]);
  const [users, setUsers] = useState<UserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<Form>({ name: '', target: '', unit: '', warning: '', critical: '', frequency: 'MONTHLY', responsibleId: '', departmentId: '', processId: '' });
  const [saving, setSaving] = useState(false);

  const [recordKpi, setRecordKpi] = useState<KpiDto | null>(null);
  const [recordValue, setRecordValue] = useState('');
  const [recording, setRecording] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<PaginatedResult<KpiDto>>('/kpis', { pageSize: 100 });
      setKpis(result.items);
    } catch (err) {
      setError(err instanceof RequestError ? err.message : 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetch();
    api.get<PaginatedResult<DepartmentDto>>('/departments', { pageSize: 100 }).then((r) => setDepartments(r.items)).catch(() => undefined);
    api.get<PaginatedResult<ProcessDto>>('/processes', { pageSize: 100 }).then((r) => setProcesses(r.items)).catch(() => undefined);
    api.get<PaginatedResult<UserDto>>('/users', { pageSize: 100 }).then((r) => setUsers(r.items)).catch(() => undefined);
  }, [fetch]);

  async function save() {
    setSaving(true);
    try {
      await api.post('/kpis', {
        name: form.name, unit: form.unit || null, target: form.target === '' ? null : Number(form.target),
        warningThreshold: form.warning === '' ? null : Number(form.warning), criticalThreshold: form.critical === '' ? null : Number(form.critical),
        frequency: form.frequency, responsibleUserId: form.responsibleId || null, departmentId: form.departmentId || null, processId: form.processId || null,
      });
      toast.success('KPI created');
      setCreateOpen(false);
      await fetch();
    } catch (err) {
      toast.error(err instanceof RequestError ? err.message : 'Could not create KPI.');
    } finally {
      setSaving(false);
    }
  }

  async function record() {
    if (!recordKpi) return;
    setRecording(true);
    try {
      await api.patch(`/kpis/${recordKpi.id}/value`, { currentValue: Number(recordValue) });
      toast.success('Value recorded');
      setRecordKpi(null);
      setRecordValue('');
      await fetch();
    } catch (err) {
      toast.error(err instanceof RequestError ? err.message : 'Could not record.');
    } finally {
      setRecording(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <PageHeader title={t('page.kpis', 'KPIs')} description={t('page.kpis_desc')} action={<Button onClick={() => setCreateOpen(true)}><PlusCircle className="size-4" /> New KPI</Button>} />

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {error ? <ErrorState message={error} onRetry={() => void fetch()} /> : loading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-md bg-muted" />)}</div>
        ) : kpis.length === 0 ? <EmptyState title={t('empty.no_kpis', 'No KPIs')} /> : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">KPI</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Current / Target</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Frequency</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Responsible</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {kpis.map((kpi) => (
                <tr key={kpi.id}>
                  <td className="px-4 py-3"><p className="font-medium text-foreground">{kpi.name}</p><p className="text-xs text-muted-foreground">{kpi.processName ?? kpi.departmentName ?? '—'}</p></td>
                  <td className="px-4 py-3"><span className="font-semibold text-foreground">{kpi.currentValue !== null ? `${kpi.currentValue}${kpi.unit ?? ''}` : '—'}</span> <span className="text-muted-foreground">/ {kpi.target !== null ? `${kpi.target}${kpi.unit ?? ''}` : '—'}</span></td>
                  <td className="px-4 py-3"><Badge variant="outline">{kpi.frequency}</Badge></td>
                  <td className="px-4 py-3 text-muted-foreground">{kpi.responsibleName ?? '—'}</td>
                  <td className="px-4 py-3 text-right"><Button size="sm" variant="outline" onClick={() => { setRecordKpi(kpi); setRecordValue(kpi.currentValue !== null ? String(kpi.currentValue) : ''); }}>Record</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New KPI</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2 sm:col-span-2"><Label htmlFor="k-name">Name</Label><Input id="k-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></div>
            <div className="flex flex-col gap-2"><Label htmlFor="k-target">Target</Label><Input id="k-target" type="number" value={form.target} onChange={(event) => setForm((current) => ({ ...current, target: event.target.value }))} /></div>
            <div className="flex flex-col gap-2"><Label htmlFor="k-unit">Unit</Label><Input id="k-unit" value={form.unit} onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value }))} /></div>
            <div className="flex flex-col gap-2"><Label htmlFor="k-warn">Warning threshold</Label><Input id="k-warn" type="number" value={form.warning} onChange={(event) => setForm((current) => ({ ...current, warning: event.target.value }))} /></div>
            <div className="flex flex-col gap-2"><Label htmlFor="k-crit">Critical threshold</Label><Input id="k-crit" type="number" value={form.critical} onChange={(event) => setForm((current) => ({ ...current, critical: event.target.value }))} /></div>
            <div className="flex flex-col gap-2">
              <Label>Frequency</Label>
              <Select value={form.frequency} onValueChange={(value) => setForm((current) => ({ ...current, frequency: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{KPI_FREQUENCIES.map((frequency) => <SelectItem key={frequency} value={frequency}>{frequency}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Responsible</Label>
              <Select value={form.responsibleId || '__none__'} onValueChange={(value) => setForm((current) => ({ ...current, responsibleId: value === '__none__' ? '' : value }))}><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger><SelectContent><SelectItem value="__none__">—</SelectItem>{users.map((user) => <SelectItem key={user.id} value={user.id}>{user.firstName} {user.lastName}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Department</Label>
              <Select value={form.departmentId || '__none__'} onValueChange={(value) => setForm((current) => ({ ...current, departmentId: value === '__none__' ? '' : value }))}><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger><SelectContent><SelectItem value="__none__">—</SelectItem>{departments.map((department) => <SelectItem key={department.id} value={department.id}>{department.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Process</Label>
              <Select value={form.processId || '__none__'} onValueChange={(value) => setForm((current) => ({ ...current, processId: value === '__none__' ? '' : value }))}><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger><SelectContent><SelectItem value="__none__">—</SelectItem>{processes.map((process) => <SelectItem key={process.id} value={process.id}>{process.name}</SelectItem>)}</SelectContent></Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => void save()} disabled={saving || !form.name}>{saving ? <Loader2 className="size-4 animate-spin" /> : null}Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!recordKpi} onOpenChange={(open) => !open && setRecordKpi(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record value — {recordKpi?.name}</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-2"><Label htmlFor="k-value">Current value{recordKpi?.unit ? ` (${recordKpi.unit})` : ''}</Label><Input id="k-value" type="number" value={recordValue} onChange={(event) => setRecordValue(event.target.value)} /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecordKpi(null)}>Cancel</Button>
            <Button onClick={() => void record()} disabled={recording || recordValue === ''}>{recording ? <Loader2 className="size-4 animate-spin" /> : null}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
