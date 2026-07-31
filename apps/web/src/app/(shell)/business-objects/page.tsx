'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, PlusCircle, Search } from 'lucide-react';
import { toast } from 'sonner';
import type { BusinessObjectDto, BusinessObjectTypeDto, DepartmentDto, PaginatedResult, ProcessDto } from '@tecpap/types';
import { Badge, Button, Input, Label } from '@tecpap/ui';
import { api, RequestError } from '@/lib/api';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState, ErrorState, PageHeader } from '@/components/admin/common';
import { useTranslation } from '@/lib/i18n';

export default function BusinessObjectsPage() {
  const [objects, setObjects] = useState<PaginatedResult<BusinessObjectDto> | null>(null);
  const { t } = useTranslation();
  const [types, setTypes] = useState<BusinessObjectTypeDto[]>([]);
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [processes, setProcesses] = useState<ProcessDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', typeId: '', departmentId: '', processId: '', status: 'ACTIVE' });
  const [saving, setSaving] = useState(false);

  const fetchObjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | undefined> = { pageSize: '50', search: search.trim() || undefined };
      if (typeFilter !== 'ALL') params.typeId = typeFilter;
      const result = await api.get<PaginatedResult<BusinessObjectDto>>('/business-objects', params);
      setObjects(result);
    } catch (err) {
      setError(err instanceof RequestError ? err.message : 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter]);

  useEffect(() => {
    void fetchObjects();
    api.get<BusinessObjectTypeDto[]>('/business-object-types/active').then(setTypes).catch(() => undefined);
    api.get<PaginatedResult<DepartmentDto>>('/departments', { pageSize: 100 }).then((r) => setDepartments(r.items)).catch(() => undefined);
  }, [fetchObjects]);

  useEffect(() => {
    if (!form.departmentId) { setProcesses([]); return; }
    api.get<PaginatedResult<ProcessDto>>('/processes', { pageSize: 100, departmentId: form.departmentId }).then((r) => setProcesses(r.items)).catch(() => setProcesses([]));
  }, [form.departmentId]);

  async function save() {
    setSaving(true);
    try {
      await api.post('/business-objects', { name: form.name, code: form.code, typeId: form.typeId, departmentId: form.departmentId, processId: form.processId || null, status: form.status });
      toast.success('Business object created');
      setDialogOpen(false);
      setForm({ name: '', code: '', typeId: types[0]?.id ?? '', departmentId: departments[0]?.id ?? '', processId: '', status: 'ACTIVE' });
      await fetchObjects();
    } catch (err) {
      toast.error(err instanceof RequestError ? err.message : 'Could not create.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <PageHeader title={t('page.business_objects', 'Business objects')} description={t('page.business_objects_desc')} action={<Button onClick={() => { setForm({ name: '', code: '', typeId: types[0]?.id ?? '', departmentId: departments[0]?.id ?? '', processId: '', status: 'ACTIVE' }); setDialogOpen(true); }}><PlusCircle className="size-4" /> New</Button>} />

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name or code…" className="pl-8" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="sm:w-56"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All types</SelectItem>
            {types.map((type) => <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {error ? <ErrorState message={error} onRetry={() => void fetchObjects()} /> : loading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-md bg-muted" />)}</div>
        ) : !objects || objects.items.length === 0 ? <EmptyState title={t('empty.no_business_objects', 'No business objects')} /> : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Department</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {objects.items.map((object) => (
                <tr key={object.id} className="hover:bg-accent/40">
                  <td className="px-4 py-3"><Link href={`/business-objects/${object.id}`} className="font-medium text-foreground hover:underline">{object.name}</Link></td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{object.code}</td>
                  <td className="px-4 py-3"><Badge variant="outline">{object.typeName ?? '—'}</Badge></td>
                  <td className="px-4 py-3 text-muted-foreground">{object.departmentName ?? '—'}</td>
                  <td className="px-4 py-3"><Badge variant={object.status === 'ACTIVE' ? 'success' : 'secondary'}>{object.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New business object</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2 sm:col-span-2"><Label htmlFor="bo-name">Name</Label><Input id="bo-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></div>
            <div className="flex flex-col gap-2"><Label htmlFor="bo-code">Code</Label><Input id="bo-code" value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} /></div>
            <div className="flex flex-col gap-2">
              <Label>Type</Label>
              <Select value={form.typeId} onValueChange={(value) => setForm((current) => ({ ...current, typeId: value }))}><SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger><SelectContent>{types.map((type) => <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Department</Label>
              <Select value={form.departmentId} onValueChange={(value) => setForm((current) => ({ ...current, departmentId: value, processId: '' }))}><SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger><SelectContent>{departments.map((department) => <SelectItem key={department.id} value={department.id}>{department.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Process (optional)</Label>
              <Select value={form.processId || '__none__'} onValueChange={(value) => setForm((current) => ({ ...current, processId: value === '__none__' ? '' : value }))}><SelectTrigger><SelectValue placeholder="No process" /></SelectTrigger><SelectContent><SelectItem value="__none__">No process</SelectItem>{processes.map((process) => <SelectItem key={process.id} value={process.id}>{process.name}</SelectItem>)}</SelectContent></Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => void save()} disabled={saving || !form.name || !form.code || !form.typeId || !form.departmentId}>{saving ? <Loader2 className="size-4 animate-spin" /> : null}Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
