'use client';

import { useMemo, useState } from 'react';
import { Lock } from 'lucide-react';
import type { PermissionCatalogResponse } from '@tecpap/types';
import { Badge, Input } from '@tecpap/ui';
import { api } from '@/lib/api';
import { useAsync } from '@/lib/use-async';
import { ErrorState, PageHeader } from '@/components/admin/common';

export default function PermissionsPage() {
  const { data: catalog, error, loading, reload } = useAsync<PermissionCatalogResponse>(() => api.get('/permissions'));
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!catalog) return [];
    const term = search.trim().toLowerCase();
    if (!term) return catalog.groups;
    return catalog.groups
      .map((group) => ({
        ...group,
        permissions: group.permissions.filter(
          (permission) =>
            permission.key.toLowerCase().includes(term) ||
            permission.label.toLowerCase().includes(term) ||
            group.group.toLowerCase().includes(term),
        ),
      }))
      .filter((group) => group.permissions.length > 0);
  }, [catalog, search]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageHeader title="Permissions" description="The DB-driven permission catalog, grouped by module." />

      <Input
        placeholder="Search permissions…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="sm:max-w-xs"
      />

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading || !catalog ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-lg border border-border bg-card" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map((group) => (
            <div key={group.group} className="rounded-lg border border-border bg-card p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Lock className="size-4 text-muted-foreground" /> {group.group}
                </h3>
                <Badge variant="outline">{group.permissions.length}</Badge>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {group.permissions.map((permission) => (
                  <div key={permission.key} className="rounded-md border border-border p-3">
                    <p className="text-sm font-medium text-foreground">{permission.label}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{permission.key}</p>
                    {permission.description ? (
                      <p className="mt-1 text-xs text-muted-foreground">{permission.description}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
