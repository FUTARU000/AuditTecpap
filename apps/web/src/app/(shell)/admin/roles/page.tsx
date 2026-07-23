'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Lock, Pencil, PlusCircle, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import type {
  PaginatedResult,
  PermissionCatalogResponse,
  RoleDto,
} from '@tecpap/types';
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
import { EmptyState, ErrorState, PageHeader } from '@/components/admin/common';

interface RoleForm {
  name: string;
  description: string;
  isGlobal: boolean;
  permissions: Set<string>;
}

export default function RolesPage() {
  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [catalog, setCatalog] = useState<PermissionCatalogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RoleDto | null>(null);
  const [form, setForm] = useState<RoleForm | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<PaginatedResult<RoleDto>>('/roles', { pageSize: 100 });
      setRoles(result.items);
    } catch (err) {
      setError(err instanceof RequestError ? err.message : 'Failed to load roles.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRoles();
    api.get<PermissionCatalogResponse>('/permissions').then(setCatalog).catch(() => undefined);
  }, [fetchRoles]);

  function openCreate() {
    setEditing(null);
    setForm({ name: '', description: '', isGlobal: false, permissions: new Set() });
    setDialogOpen(true);
  }

  function openEdit(role: RoleDto) {
    setEditing(role);
    setForm({ name: role.name, description: role.description ?? '', isGlobal: role.isGlobal, permissions: new Set(role.permissions) });
    setDialogOpen(true);
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      const body = {
        name: form.name,
        description: form.description || null,
        isGlobal: form.isGlobal,
        permissions: [...form.permissions],
      };
      if (editing) {
        await api.patch<RoleDto>(`/roles/${editing.id}`, body);
        toast.success('Role updated');
      } else {
        await api.post<RoleDto>('/roles', body);
        toast.success('Role created');
      }
      setDialogOpen(false);
      await fetchRoles();
    } catch (err) {
      toast.error(err instanceof RequestError ? err.message : 'Could not save role.');
    } finally {
      setSaving(false);
    }
  }

  function togglePermission(key: string) {
    setForm((current) => {
      if (!current) return current;
      const next = new Set(current.permissions);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return { ...current, permissions: next };
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <PageHeader
        title="Roles"
        description="Group permissions into roles. System roles are protected from deletion."
        action={
          <Button onClick={openCreate}>
            <PlusCircle className="size-4" /> New role
          </Button>
        }
      />

      {error ? (
        <ErrorState message={error} onRetry={() => void fetchRoles()} />
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-36 animate-pulse rounded-lg border border-border bg-card" />
          ))}
        </div>
      ) : roles.length === 0 ? (
        <EmptyState title="No roles yet" description="Create your first role to group permissions." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((role) => (
            <div key={role.id} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <ShieldCheck className="size-4" />
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">{role.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{role.slug}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => openEdit(role)} aria-label="Edit role">
                  <Pencil className="size-4" />
                </Button>
              </div>
              <p className="line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">{role.description ?? 'No description'}</p>
              <div className="flex flex-wrap items-center gap-1.5">
                {role.isSystem ? <Badge variant="secondary"><Lock className="size-3" /> System</Badge> : null}
                {role.isGlobal ? <Badge variant="outline">Global scope</Badge> : <Badge variant="outline">Department-scoped</Badge>}
                <Badge variant="outline">{role.permissions.length} permissions</Badge>
                <Badge variant="outline">{role.userCount} user(s)</Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit role' : 'New role'}</DialogTitle>
            <DialogDescription>
              Assign permissions grouped by module. {editing?.isSystem ? 'This is a system role.' : ''}
            </DialogDescription>
          </DialogHeader>
          {form ? (
            <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2"><Label htmlFor="roleName">Name</Label><Input id="roleName" value={form.name} onChange={(event) => setForm((current) => current && ({ ...current, name: event.target.value }))} /></div>
                <div className="flex flex-col gap-2"><Label htmlFor="roleDesc">Description</Label><Input id="roleDesc" value={form.description} onChange={(event) => setForm((current) => current && ({ ...current, description: event.target.value }))} /></div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={form.isGlobal} onCheckedChange={(value) => setForm((current) => current && ({ ...current, isGlobal: value === true }))} />
                Global scope (bypass department data-scoping)
              </label>

              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">Permissions</p>
                <span className="text-xs text-muted-foreground">{form.permissions.size} selected</span>
              </div>
              {catalog?.groups.map((group) => (
                <div key={group.group} className="rounded-md border border-border p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.group}</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {group.permissions.map((permission) => (
                      <label key={permission.key} className="flex items-start gap-2 text-sm">
                        <Checkbox
                          checked={form.permissions.has(permission.key)}
                          onCheckedChange={() => togglePermission(permission.key)}
                          className="mt-0.5"
                        />
                        <span>
                          <span className="text-foreground">{permission.label}</span>
                          <span className="block font-mono text-[11px] text-muted-foreground">{permission.key}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              {editing ? 'Save changes' : 'Create role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
