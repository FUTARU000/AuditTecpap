'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Loader2,
  MoreHorizontal,
  Pencil,
  PlusCircle,
  RotateCcw,
  Trash2,
  UserX,
} from 'lucide-react';
import { toast } from 'sonner';
import type { DepartmentDto, PaginatedResult, RoleDto, UserDto, UserStatus } from '@tecpap/types';
import { Badge, Button, Input, Label } from '@tecpap/ui';
import { api, RequestError } from '@/lib/api';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { EmptyState, ErrorState, PageHeader, Pagination, SortHeader, TableSkeleton } from '@/components/admin/common';
import { useTranslation } from '@/lib/i18n';

const STATUS_OPTIONS: Array<{ value: UserStatus; label: string }> = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'LOCKED', label: 'Locked' },
];

function StatusBadge({ status }: { status: UserStatus }) {
  const variant = status === 'ACTIVE' ? 'success' : status === 'LOCKED' ? 'danger' : 'secondary';
  return <Badge variant={variant}>{status}</Badge>;
}

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  employeeNumber: string;
  phone: string;
  roleId: string;
  departmentId: string;
  status: UserStatus;
  password: string;
}

const EMPTY_FORM: FormState = {
  firstName: '',
  lastName: '',
  email: '',
  employeeNumber: '',
  phone: '',
  roleId: '',
  departmentId: '',
  status: 'ACTIVE',
  password: '',
};

export default function UsersPage() {
  const [data, setData] = useState<PaginatedResult<UserDto> | null>(null);
  const { t } = useTranslation();
  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [sort, setSort] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<UserStatus | 'ALL'>('ALL');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<UserDto | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(handle);
  }, [search]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number | undefined> = { page, pageSize, search: debouncedSearch, sort };
      if (statusFilter !== 'ALL') params.status = statusFilter;
      const result = await api.get<PaginatedResult<UserDto>>('/users', params);
      setData(result);
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof RequestError ? err.message : 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, sort, statusFilter]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    Promise.all([
      api.get<PaginatedResult<RoleDto>>('/roles', { pageSize: 100 }),
      api.get<PaginatedResult<DepartmentDto>>('/departments', { pageSize: 100 }),
    ])
      .then(([rolesResult, departmentsResult]) => {
        setRoles(rolesResult.items);
        setDepartments(departmentsResult.items);
      })
      .catch(() => undefined);
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, roleId: roles[0]?.id ?? '', departmentId: '' });
    setDialogOpen(true);
  }

  function openEdit(user: UserDto) {
    setEditing(user);
    setForm({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      employeeNumber: user.employeeNumber ?? '',
      phone: user.phone ?? '',
      roleId: user.roleId,
      departmentId: user.departmentId ?? '',
      status: user.status,
      password: '',
    });
    setDialogOpen(true);
  }

  async function save() {
    setSaving(true);
    try {
      const body = {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email.trim(),
        employeeNumber: form.employeeNumber || null,
        phone: form.phone || null,
        roleId: form.roleId,
        departmentId: form.departmentId || null,
        status: form.status,
        ...(editing ? {} : { password: form.password }),
      };
      if (editing) {
        await api.patch<UserDto>(`/users/${editing.id}`, body);
        toast.success('User updated');
      } else {
        await api.post<UserDto>('/users', body);
        toast.success('User created');
      }
      setDialogOpen(false);
      await fetchUsers();
    } catch (err) {
      toast.error(err instanceof RequestError ? err.message : 'Could not save user.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/users/${deleteTarget.id}`);
      toast.success('User deactivated');
      setDeleteTarget(null);
      await fetchUsers();
    } catch (err) {
      toast.error(err instanceof RequestError ? err.message : 'Could not deactivate user.');
    } finally {
      setDeleting(false);
    }
  }

  async function bulkStatus(status: UserStatus) {
    if (selected.size === 0) return;
    try {
      const result = await api.post<{ updated: number }>('/users/bulk-status', {
        ids: [...selected],
        status,
      });
      toast.success(`${result.updated} user(s) updated`);
      await fetchUsers();
    } catch (err) {
      toast.error(err instanceof RequestError ? err.message : 'Bulk update failed.');
    }
  }

  async function resetPassword(user: UserDto) {
    try {
      const result = await api.post<{ resetToken: string }>(`/users/${user.id}/reset-password`);
      toast.success('Reset token generated', { description: result.resetToken });
    } catch (err) {
      toast.error(err instanceof RequestError ? err.message : 'Could not reset password.');
    }
  }

  const allSelected = useMemo(
    () => !!data && data.items.length > 0 && data.items.every((item) => selected.has(item.id)),
    [data, selected],
  );

  function toggleAll() {
    setSelected((current) => {
      if (data && data.items.every((item) => current.has(item.id))) {
        return new Set();
      }
      return new Set(data ? data.items.map((item) => item.id) : []);
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <PageHeader
        title={t('page.users', 'Users')}
        description={t('page.users_desc')}
        action={
          <Button onClick={openCreate}>
            <PlusCircle className="size-4" /> New user
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Search by name or email…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="sm:max-w-xs"
        />
        <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value as UserStatus | 'ALL'); setPage(1); }}>
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selected.size > 0 ? (
          <div className="flex items-center gap-2 sm:ml-auto">
            <span className="text-sm text-muted-foreground">{selected.size} selected</span>
            <Button variant="outline" size="sm" onClick={() => void bulkStatus('ACTIVE')}>
              <CheckCircle2 className="size-4" /> Activate
            </Button>
            <Button variant="outline" size="sm" onClick={() => void bulkStatus('INACTIVE')}>
              <UserX className="size-4" /> Deactivate
            </Button>
          </div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {error ? (
          <ErrorState message={error} onRetry={() => void fetchUsers()} />
        ) : loading ? (
          <TableSkeleton columns={6} />
        ) : data && data.items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                  </th>
                  <th className="px-4 py-3 text-left"><SortHeader label="Name" field="lastName" sort={sort} onSort={setSort} /></th>
                  <th className="px-4 py-3 text-left"><SortHeader label="Email" field="email" sort={sort} onSort={setSort} /></th>
                  <th className="px-4 py-3 text-left">Role</th>
                  <th className="px-4 py-3 text-left">Department</th>
                  <th className="px-4 py-3 text-left"><SortHeader label="Status" field="status" sort={sort} onSort={setSort} /></th>
                  <th className="w-10 px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map((user) => {
                  const isSelected = selected.has(user.id);
                  return (
                    <tr key={user.id} className={isSelected ? 'bg-accent/40' : undefined}>
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => {
                            setSelected((current) => {
                              const next = new Set(current);
                              if (next.has(user.id)) {
                                next.delete(user.id);
                              } else {
                                next.add(user.id);
                              }
                              return next;
                            });
                          }}
                          aria-label={`Select ${user.email}`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{user.firstName} {user.lastName}</div>
                        {user.employeeNumber ? <div className="text-xs text-muted-foreground">{user.employeeNumber}</div> : null}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{user.roleName ?? user.roleSlug}</Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{user.departmentName ?? '—'}</td>
                      <td className="px-4 py-3"><StatusBadge status={user.status} /></td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Actions">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openEdit(user)}><Pencil className="size-4" /> Edit</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void resetPassword(user)}><RotateCcw className="size-4" /> Reset password</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => user.status === 'ACTIVE' ? void bulkStatusById(user.id, 'INACTIVE') : void bulkStatusById(user.id, 'ACTIVE')}>
                              {user.status === 'ACTIVE' ? <UserX className="size-4" /> : <CheckCircle2 className="size-4" />}
                              {user.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(user)}>
                              <Trash2 className="size-4" /> Deactivate (delete)
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title={t('empty.no_users', 'No users found')} description="Try adjusting your search or filters, or create a new user." />
        )}
        {data ? (
          <div className="border-t border-border px-4">
            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              total={data.total}
              canPrev={data.page > 1}
              canNext={data.page < data.totalPages}
              onPrev={() => setPage((current) => Math.max(1, current - 1))}
              onNext={() => setPage((current) => current + 1)}
            />
          </div>
        ) : null}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit user' : 'New user'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Update the account details.' : 'Create a new platform account.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2"><Label htmlFor="firstName">First name</Label><Input id="firstName" value={form.firstName} onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))} /></div>
            <div className="flex flex-col gap-2"><Label htmlFor="lastName">Last name</Label><Input id="lastName" value={form.lastName} onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} /></div>
            <div className="flex flex-col gap-2 sm:col-span-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></div>
            <div className="flex flex-col gap-2"><Label htmlFor="employeeNumber">Employee #</Label><Input id="employeeNumber" value={form.employeeNumber} onChange={(event) => setForm((current) => ({ ...current, employeeNumber: event.target.value }))} /></div>
            <div className="flex flex-col gap-2"><Label htmlFor="phone">Phone</Label><Input id="phone" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} /></div>
            <div className="flex flex-col gap-2">
              <Label>Role</Label>
              <Select value={form.roleId} onValueChange={(value) => setForm((current) => ({ ...current, roleId: value }))}>
                <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>{roles.map((role) => <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Department</Label>
              <Select value={form.departmentId || '__none__'} onValueChange={(value) => setForm((current) => ({ ...current, departmentId: value === '__none__' ? '' : value }))}>
                <SelectTrigger><SelectValue placeholder="No department" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No department</SelectItem>
                  {departments.map((department) => <SelectItem key={department.id} value={department.id}>{department.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value as UserStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {!editing ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Temporary password</Label>
                <Input id="password" type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} />
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              {editing ? 'Save changes' : 'Create user'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate this user?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.email} will be deactivated and signed out. This is a soft delete —
              the account is never permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDelete()} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <Loader2 className="size-4 animate-spin" /> : null}
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  async function bulkStatusById(id: string, status: UserStatus) {
    try {
      await api.post('/users/bulk-status', { ids: [id], status });
      toast.success('User updated');
      await fetchUsers();
    } catch (err) {
      toast.error(err instanceof RequestError ? err.message : 'Update failed.');
    }
  }
}
