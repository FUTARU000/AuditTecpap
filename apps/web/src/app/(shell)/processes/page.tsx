'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, PlusCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { DepartmentDto, PaginatedResult, ProcessDto, ProcessStatus } from '@tecpap/types';
import { Badge, Button, Input, Label } from '@tecpap/ui';
import { api, RequestError } from '@/lib/api';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState, ErrorState, PageHeader } from '@/components/admin/common';
import { useTranslation } from '@/lib/i18n';

export default function ProcessesPage() {
  const [processes, setProcesses] = useState<ProcessDto[]>([]);
  const { t } = useTranslation();
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', departmentId: '', description: '', status: 'ACTIVE' as ProcessStatus });
  const [saving, setSaving] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<PaginatedResult<ProcessDto>>('/processes', { pageSize: 100 });
      setProcesses(result.items);
    } catch (err) {
      setError(err instanceof RequestError ? err.message : 'Failed to load processes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetch();
    api.get<PaginatedResult<DepartmentDto>>('/departments', { pageSize: 100 }).then((result) => setDepartments(result.items)).catch(() => undefined);
  }, [fetch]);

  async function save() {
    setSaving(true);
    try {
      await api.post('/processes', { code: form.code, name: form.name, departmentId: form.departmentId, description: form.description || null, status: form.status });
      toast.success('Process created');
      setDialogOpen(false);
      setForm({ code: '', name: '', departmentId: departments[0]?.id ?? '', description: '', status: 'ACTIVE' });
      await fetch();
    } catch (err) {
      toast.error(err instanceof RequestError ? err.message : 'Could not create process.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <PageHeader title={t('page.processes', 'Processes')} description={t('page.processes_desc')} action={<Button onClick={() => { setForm({ code: '', name: '', departmentId: departments[0]?.id ?? '', description: '', status: 'ACTIVE' }); setDialogOpen(true); }}><PlusCircle className="size-4" /> New process</Button>} />

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {error ? <ErrorState message={error} onRetry={() => void fetch()} /> : loading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-md bg-muted" />)}</div>
        ) : processes.length === 0 ? <EmptyState title={t('empty.no_processes', 'No processes')} description="Create the first process for a department." /> : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Department</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Owner</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Documents</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {processes.map((process) => (
                <tr key={process.id}>
                  <td className="px-4 py-3"><Badge variant="outline" className="font-mono">{process.code}</Badge></td>
                  <td className="px-4 py-3 font-medium text-foreground"><Link href={`/processes/${process.id}`} className="hover:underline">{process.name}</Link></td>
                  <td className="px-4 py-3 text-muted-foreground">{process.departmentName ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{process.ownerName ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{process.documentCount}</td>
                  <td className="px-4 py-3"><Badge variant={process.status === 'ACTIVE' ? 'success' : 'secondary'}>{process.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New process</DialogTitle><DialogDescription>Define a process within a department.</DialogDescription></DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2"><Label htmlFor="pcode">Code</Label><Input id="pcode" value={form.code} onChange={(e) => setForm((c) => ({ ...c, code: e.target.value.toUpperCase() }))} /></div>
            <div className="flex flex-col gap-2"><Label htmlFor="pname">Name</Label><Input id="pname" value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} /></div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label>Department</Label>
              <Select value={form.departmentId} onValueChange={(v) => setForm((c) => ({ ...c, departmentId: v }))}><SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger><SelectContent>{departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2"><Label htmlFor="pdesc">Description</Label><Textarea id="pdesc" value={form.description} onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => void save()} disabled={saving || !form.code || !form.name || !form.departmentId}>{saving ? <Loader2 className="size-4 animate-spin" /> : null}Create process</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
