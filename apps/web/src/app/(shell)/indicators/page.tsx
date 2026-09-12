'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, PlusCircle, Search } from 'lucide-react';
import { toast } from 'sonner';
import {
  INDICATOR_DIRECTION,
  INDICATOR_FREQUENCY,
  type DepartmentDto,
  type IndicatorDirection,
  type IndicatorDto,
  type IndicatorEvaluationStatus,
  type IndicatorFrequency,
  type PaginatedResult,
  type UserDto,
} from '@tecpap/types';
import { Button, Input, Label } from '@tecpap/ui';
import { api, RequestError } from '@/lib/api';
import {
  Dialog,
  DialogContent,
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
import { useTranslation } from '@/lib/i18n';
import { useAuth } from '@/lib/auth-context';
import { DIRECTION_LABELS, frequencyLabel, STATUS_LABELS } from './indicator-labels';
import { IndicatorStatusBadge } from './indicator-status-badge';

interface IndicatorForm {
  code: string;
  name: string;
  description: string;
  departmentId: string;
  category: string;
  unit: string;
  direction: IndicatorDirection;
  target: string;
  warningThreshold: string;
  criticalThreshold: string;
  frequency: IndicatorFrequency;
  responsibleUserId: string;
}

const emptyForm = (): IndicatorForm => ({
  code: '',
  name: '',
  description: '',
  departmentId: '',
  category: '',
  unit: '',
  direction: 'HIGHER_IS_BETTER',
  target: '',
  warningThreshold: '',
  criticalThreshold: '',
  frequency: 'MONTHLY',
  responsibleUserId: '',
});

export default function IndicatorsPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('indicators.create') || hasPermission('indicators.update');

  const [indicators, setIndicators] = useState<IndicatorDto[]>([]);
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [users, setUsers] = useState<UserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState<'true' | 'false' | ''>('true');
  const [statusFilter, setStatusFilter] = useState('');

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<IndicatorForm>(emptyForm());
  const [saving, setSaving] = useState(false);

  const fetchIndicators = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<PaginatedResult<IndicatorDto>>('/indicators', {
        pageSize: 100,
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(departmentFilter ? { departmentId: departmentFilter } : {}),
        ...(categoryFilter ? { category: categoryFilter } : {}),
        ...(activeFilter ? { active: activeFilter } : {}),
        ...(statusFilter ? { status: statusFilter as never } : {}),
      });
      setIndicators(result.items);
    } catch (err) {
      setError(err instanceof RequestError ? err.message : 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, [search, departmentFilter, categoryFilter, activeFilter, statusFilter]);

  useEffect(() => {
    const timeout = setTimeout(() => void fetchIndicators(), 250);
    return () => clearTimeout(timeout);
  }, [fetchIndicators]);

  useEffect(() => {
    api
      .get<PaginatedResult<DepartmentDto>>('/departments', { pageSize: 100 })
      .then((r) => setDepartments(r.items))
      .catch(() => undefined);
    api
      .get<PaginatedResult<UserDto>>('/users', { pageSize: 500 })
      .then((r) => setUsers(r.items))
      .catch(() => undefined);
  }, []);

  const usersInDepartment = form.departmentId
    ? users.filter((u) => u.departmentId === form.departmentId)
    : [];
  const categories = [
    ...new Set(indicators.map((i) => i.category).filter((c): c is string => !!c)),
  ].sort();

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setOpen(true);
  }

  function openEdit(indicator: IndicatorDto) {
    setEditingId(indicator.id);
    setForm({
      code: indicator.code,
      name: indicator.name,
      description: indicator.description ?? '',
      departmentId: indicator.departmentId,
      category: indicator.category ?? '',
      unit: indicator.unit ?? '',
      direction: indicator.direction,
      target: indicator.target?.toString() ?? '',
      warningThreshold: indicator.warningThreshold?.toString() ?? '',
      criticalThreshold: indicator.criticalThreshold?.toString() ?? '',
      frequency: indicator.frequency,
      responsibleUserId: indicator.responsibleUserId ?? '',
    });
    setOpen(true);
  }

  async function save() {
    if (!form.code.trim() || !form.name.trim() || !form.departmentId) {
      toast.error('Fill in code, name and department.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        departmentId: form.departmentId,
        category: form.category.trim() || undefined,
        unit: form.unit.trim() || undefined,
        direction: form.direction,
        target: form.target.trim() ? Number(form.target) : undefined,
        warningThreshold: form.warningThreshold.trim() ? Number(form.warningThreshold) : undefined,
        criticalThreshold: form.criticalThreshold.trim()
          ? Number(form.criticalThreshold)
          : undefined,
        frequency: form.frequency,
        responsibleUserId: form.responsibleUserId || undefined,
      };
      if (editingId) {
        await api.patch(`/indicators/${editingId}`, payload);
        toast.success('Indicator updated');
      } else {
        await api.post('/indicators', payload);
        toast.success('Indicator created');
      }
      setOpen(false);
      await fetchIndicators();
    } catch (err) {
      toast.error(err instanceof RequestError ? err.message : 'Could not save indicator.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(indicator: IndicatorDto) {
    try {
      await api.post(
        `/indicators/${indicator.id}/${indicator.active ? 'deactivate' : 'activate'}`,
        {},
      );
      toast.success(indicator.active ? 'Indicator deactivated' : 'Indicator activated');
      await fetchIndicators();
    } catch (err) {
      toast.error(err instanceof RequestError ? err.message : 'Could not update indicator.');
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <PageHeader
        title={t('indicators.title', 'Indicators')}
        description={t(
          'indicators.desc',
          'Track quality indicators against their targets, period by period.',
        )}
        action={
          canManage ? (
            <Button onClick={openCreate}>
              <PlusCircle className="size-4" /> New indicator
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
          <Input
            className="pl-8"
            placeholder={t('indicators.search_placeholder', 'Search by name or code…')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={departmentFilter || '__all__'}
          onValueChange={(v) => setDepartmentFilter(v === '__all__' ? '' : v)}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All departments</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={categoryFilter || '__all__'}
          onValueChange={(v) => setCategoryFilter(v === '__all__' ? '' : v)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter || '__all__'}
          onValueChange={(v) => setStatusFilter(v === '__all__' ? '' : v)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All statuses</SelectItem>
            {(Object.keys(STATUS_LABELS) as IndicatorEvaluationStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={activeFilter || '__all__'}
          onValueChange={(v) => setActiveFilter(v === '__all__' ? '' : (v as 'true' | 'false'))}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Active" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All</SelectItem>
            <SelectItem value="true">Active</SelectItem>
            <SelectItem value="false">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border-border bg-card overflow-hidden rounded-lg border">
        {error ? (
          <ErrorState message={error} onRetry={() => void fetchIndicators()} />
        ) : loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-muted h-10 animate-pulse rounded-md" />
            ))}
          </div>
        ) : indicators.length === 0 ? (
          <EmptyState
            title={t('empty.no_indicators', 'No indicators')}
            description="Create your first indicator to start tracking values."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-border bg-muted/50 border-b">
                <tr>
                  <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium uppercase tracking-wide">
                    Indicator
                  </th>
                  <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium uppercase tracking-wide">
                    Department
                  </th>
                  <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium uppercase tracking-wide">
                    Responsible
                  </th>
                  <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium uppercase tracking-wide">
                    Frequency
                  </th>
                  <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium uppercase tracking-wide">
                    Current value
                  </th>
                  <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium uppercase tracking-wide">
                    Target
                  </th>
                  <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium uppercase tracking-wide">
                    Last measured
                  </th>
                  <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium uppercase tracking-wide">
                    Status
                  </th>
                  {canManage ? <th className="px-4 py-3" /> : null}
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {indicators.map((indicator) => (
                  <tr
                    key={indicator.id}
                    className={`hover:bg-accent/40 ${!indicator.active ? 'opacity-60' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/indicators/${indicator.id}`}
                        className="text-foreground font-medium hover:underline"
                      >
                        {indicator.name}
                      </Link>
                      <div className="text-muted-foreground text-xs">
                        {indicator.code}
                        {indicator.category ? ` · ${indicator.category}` : ''}
                      </div>
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {indicator.departmentName ?? '—'}
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {indicator.responsibleName ?? '—'}
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {frequencyLabel(indicator.frequency, t)}
                    </td>
                    <td className="text-foreground px-4 py-3 font-medium">
                      {indicator.latestValue
                        ? `${indicator.latestValue.value}${indicator.unit ?? ''}`
                        : '—'}
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {indicator.target !== null
                        ? `${indicator.target}${indicator.unit ?? ''}`
                        : '—'}
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {indicator.latestValue
                        ? new Date(indicator.latestValue.measuredAt).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <IndicatorStatusBadge status={indicator.status} />
                    </td>
                    {canManage ? (
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(indicator)}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void toggleActive(indicator)}
                          >
                            {indicator.active ? 'Deactivate' : 'Activate'}
                          </Button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit indicator' : 'New indicator'}</DialogTitle>
          </DialogHeader>
          <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="i-code">Code</Label>
                <Input
                  id="i-code"
                  value={form.code}
                  onChange={(e) => setForm((c) => ({ ...c, code: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="i-category">Category (optional)</Label>
                <Input
                  id="i-category"
                  value={form.category}
                  onChange={(e) => setForm((c) => ({ ...c, category: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="i-name">Name</Label>
                <Input
                  id="i-name"
                  value={form.name}
                  onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="i-desc">Description (optional)</Label>
                <Textarea
                  id="i-desc"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Department</Label>
                <Select
                  value={form.departmentId || '__none__'}
                  onValueChange={(v) =>
                    setForm((c) => ({
                      ...c,
                      departmentId: v === '__none__' ? '' : v,
                      responsibleUserId: '',
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__" disabled>
                      Select
                    </SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Responsible (optional)</Label>
                <Select
                  value={form.responsibleUserId || '__none__'}
                  onValueChange={(v) =>
                    setForm((c) => ({ ...c, responsibleUserId: v === '__none__' ? '' : v }))
                  }
                  disabled={!form.departmentId}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={form.departmentId ? 'None' : 'Pick a department first'}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {usersInDepartment.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.firstName} {u.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Frequency</Label>
                <Select
                  value={form.frequency}
                  onValueChange={(v) =>
                    setForm((c) => ({ ...c, frequency: v as IndicatorFrequency }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INDICATOR_FREQUENCY.map((f) => (
                      <SelectItem key={f} value={f}>
                        {frequencyLabel(f, t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Unit (optional)</Label>
                <Input
                  placeholder="%, days, units…"
                  value={form.unit}
                  onChange={(e) => setForm((c) => ({ ...c, unit: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label>Direction</Label>
                <Select
                  value={form.direction}
                  onValueChange={(v) =>
                    setForm((c) => ({ ...c, direction: v as IndicatorDirection }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INDICATOR_DIRECTION.map((d) => (
                      <SelectItem key={d} value={d}>
                        {DIRECTION_LABELS[d]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="i-target">Target (optional)</Label>
                <Input
                  id="i-target"
                  type="number"
                  value={form.target}
                  onChange={(e) => setForm((c) => ({ ...c, target: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="i-warn">Warning threshold (optional)</Label>
                <Input
                  id="i-warn"
                  type="number"
                  value={form.warningThreshold}
                  onChange={(e) => setForm((c) => ({ ...c, warningThreshold: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="i-crit">Critical threshold (optional)</Label>
                <Input
                  id="i-crit"
                  type="number"
                  value={form.criticalThreshold}
                  onChange={(e) => setForm((c) => ({ ...c, criticalThreshold: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              {editingId ? 'Save changes' : 'Create indicator'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
