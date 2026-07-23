'use client';

import { useCallback, useEffect, useState } from 'react';
import { Building2, Loader2, Pencil, PlusCircle, Users } from 'lucide-react';
import { toast } from 'sonner';
import type {
  DepartmentDto,
  DepartmentStatsDto,
  DepartmentStatus,
  PaginatedResult,
  UserDto,
} from '@tecpap/types';
import { Badge, Button, Input, Label } from '@tecpap/ui';
import { api, RequestError } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState, ErrorState, PageHeader } from '@/components/admin/common';

interface DeptForm {
  code: string;
  name: string;
  description: string;
  sortOrder: string;
  status: DepartmentStatus;
  managerId: string;
}

const EMPTY_FORM: DeptForm = { code: '', name: '', description: '', sortOrder: '0', status: 'ACTIVE', managerId: '' };

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [stats, setStats] = useState<DepartmentStatsDto | null>(null);
  const [managers, setManagers] = useState<UserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DepartmentDto | null>(null);
  const [form, setForm] = useState<DeptForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, statsResult] = await Promise.all([
        api.get<PaginatedResult<DepartmentDto>>('/departments', { pageSize: 100 }),
        api.get<DepartmentStatsDto>('/departments/stats'),
      ]);
      setDepartments(list.items);
      setStats(statsResult);
      const users = await api
        .get<PaginatedResult<UserDto>>('/users', { pageSize: 100 })
        .then((result) => result.items)
        .catch(() => [] as UserDto[]);
      setManagers(users);
    } catch (err) {
      setError(err instanceof RequestError ? err.message : 'Failed to load departments.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(department: DepartmentDto) {
    setEditing(department);
    setForm({
      code: department.code,
      name: department.name,
      description: department.description ?? '',
      sortOrder: String(department.sortOrder),
      status: department.status,
      managerId: department.managerId ?? '',
    });
    setDialogOpen(true);
  }

  async function save() {
    setSaving(true);
    try {
      const body = {
        code: form.code.toUpperCase(),
        name: form.name,
        description: form.description || null,
        sortOrder: Number(form.sortOrder) || 0,
        status: form.status,
        managerId: form.managerId || null,
      };
      if (editing) {
        await api.patch<DepartmentDto>(`/departments/${editing.id}`, body);
        toast.success('Department updated');
      } else {
        await api.post<DepartmentDto>('/departments', body);
        toast.success('Department created');
      }
      setDialogOpen(false);
      await fetchAll();
    } catch (err) {
      toast.error(err instanceof RequestError ? err.message : 'Could not save department.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <PageHeader
        title="Departments"
        description="Organizational units used for data-scoping and assignment."
        action={
          <Button onClick={openCreate}>
            <PlusCircle className="size-4" /> New department
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Departments', value: stats?.total ?? '—' },
          { label: 'Active', value: stats?.active ?? '—' },
          { label: 'Inactive', value: stats?.inactive ?? '—' },
          { label: 'Total members', value: stats?.totalMembers ?? '—' },
        ].map((card) => (
          <div key={card.label} className="rounded-lg border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className="text-2xl font-semibold text-foreground">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {error ? (
          <ErrorState message={error} onRetry={() => void fetchAll()} />
        ) : loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-12 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : departments.length === 0 ? (
          <EmptyState title="No departments" description="Create your first department." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Code</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Manager</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Members</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</th>
                  <th className="w-10 px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {departments.map((department) => (
                  <tr key={department.id}>
                    <td className="px-4 py-3"><Badge variant="outline" className="font-mono">{department.code}</Badge></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 font-medium text-foreground">
                        <Building2 className="size-4 text-muted-foreground" /> {department.name}
                      </div>
                      {department.description ? <div className="text-xs text-muted-foreground">{department.description}</div> : null}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{department.managerName ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-muted-foreground"><Users className="size-4" /> {department.memberCount}</span>
                    </td>
                    <td className="px-4 py-3"><Badge variant={department.status === 'ACTIVE' ? 'success' : 'secondary'}>{department.status}</Badge></td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(department)} aria-label="Edit department">
                        <Pencil className="size-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit department' : 'New department'}</DialogTitle>
            <DialogDescription>{editing ? 'Update the department details.' : 'Create a new organizational unit.'}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2"><Label htmlFor="code">Code</Label><Input id="code" value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} /></div>
            <div className="flex flex-col gap-2"><Label htmlFor="name">Name</Label><Input id="name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></div>
            <div className="flex flex-col gap-2 sm:col-span-2"><Label htmlFor="desc">Description</Label><Textarea id="desc" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></div>
            <div className="flex flex-col gap-2"><Label htmlFor="sort">Sort order</Label><Input id="sort" type="number" value={form.sortOrder} onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))} /></div>
            <div className="flex flex-col gap-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value as DepartmentStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label>Manager</Label>
              <Select value={form.managerId || '__none__'} onValueChange={(value) => setForm((current) => ({ ...current, managerId: value === '__none__' ? '' : value }))}>
                <SelectTrigger><SelectValue placeholder="No manager" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No manager</SelectItem>
                  {managers.map((manager) => <SelectItem key={manager.id} value={manager.id}>{manager.firstName} {manager.lastName} — {manager.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              {editing ? 'Save changes' : 'Create department'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
