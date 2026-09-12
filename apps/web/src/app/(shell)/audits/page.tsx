'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, PlusCircle, Search } from 'lucide-react';
import { toast } from 'sonner';
import { AUDIT_STATUSES } from '@tecpap/config';
import type {
  AuditDto,
  AuditTemplateDto,
  DepartmentDto,
  PaginatedResult,
  ProcessDto,
  UserDto,
} from '@tecpap/types';
import { Badge, Button, Input, Label } from '@tecpap/ui';
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
import { DatePicker } from '@/components/ui/date-picker';
import { EmptyState, ErrorState, PageHeader } from '@/components/admin/common';
import { useTranslation } from '@/lib/i18n';

const STATUS_TONE: Record<string, 'secondary' | 'warning' | 'success' | 'danger' | 'outline'> = {
  PLANNED: 'secondary',
  IN_PROGRESS: 'warning',
  SUBMITTED: 'outline',
  UNDER_REVIEW: 'outline',
  RETURNED: 'danger',
  APPROVED: 'success',
  COMPLETED: 'success',
};

interface AuditFilterState {
  search: string;
  status: string;
  departmentId: string;
  templateId: string;
  auditorId: string;
  dateFrom: string;
  dateTo: string;
}
const DEFAULT_AUDIT_FILTERS: AuditFilterState = {
  search: '',
  status: '',
  departmentId: '',
  templateId: '',
  auditorId: '',
  dateFrom: '',
  dateTo: '',
};

export default function AuditsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [audits, setAudits] = useState<PaginatedResult<AuditDto> | null>(null);
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<AuditTemplateDto[]>([]);
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [processes, setProcesses] = useState<ProcessDto[]>([]);
  const [users, setUsers] = useState<UserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    templateId: '',
    departmentId: '',
    processId: '',
    auditorId: '',
    scheduledDate: '',
  });
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState<AuditFilterState>(() => ({
    search: searchParams.get('q') ?? '',
    status: searchParams.get('status') ?? '',
    departmentId: searchParams.get('departmentId') ?? '',
    templateId: searchParams.get('templateId') ?? '',
    auditorId: searchParams.get('auditorId') ?? '',
    dateFrom: searchParams.get('dateFrom') ?? '',
    dateTo: searchParams.get('dateTo') ?? '',
  }));

  const fetchAudits = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number | undefined> = { pageSize: 50 };
      const trimmed = filters.search.trim();
      if (trimmed) params.search = trimmed;
      if (filters.status) params.status = filters.status;
      if (filters.departmentId) params.departmentId = filters.departmentId;
      if (filters.templateId) params.templateId = filters.templateId;
      if (filters.auditorId) params.auditorId = filters.auditorId;
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;
      setAudits(await api.get<PaginatedResult<AuditDto>>('/audits', params));
    } catch (err) {
      setError(err instanceof RequestError ? err.message : 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void fetchAudits();
    const params = new URLSearchParams();
    if (filters.search) params.set('q', filters.search);
    if (filters.status) params.set('status', filters.status);
    if (filters.departmentId) params.set('departmentId', filters.departmentId);
    if (filters.templateId) params.set('templateId', filters.templateId);
    if (filters.auditorId) params.set('auditorId', filters.auditorId);
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);
    const qs = params.toString();
    router.replace(qs ? `/audits?${qs}` : '/audits', { scroll: false });
  }, [fetchAudits, filters, router]);

  useEffect(() => {
    api
      .get<PaginatedResult<AuditTemplateDto>>('/audit-templates', {
        pageSize: 100,
        status: 'PUBLISHED' as never,
      })
      .then((r) => setTemplates(r.items.filter((t) => t.status === 'PUBLISHED')))
      .catch(() => undefined);
    api
      .get<PaginatedResult<DepartmentDto>>('/departments', { pageSize: 100 })
      .then((r) => setDepartments(r.items))
      .catch(() => undefined);
    api
      .get<PaginatedResult<ProcessDto>>('/processes', { pageSize: 100 })
      .then((r) => setProcesses(r.items))
      .catch(() => undefined);
    api
      .get<PaginatedResult<UserDto>>('/users', { pageSize: 100 })
      .then((r) => setUsers(r.items))
      .catch(() => undefined);
  }, []);

  function clearFilters() {
    setFilters(DEFAULT_AUDIT_FILTERS);
  }
  const hasActiveFilters = !!(
    filters.search ||
    filters.status ||
    filters.departmentId ||
    filters.templateId ||
    filters.auditorId ||
    filters.dateFrom ||
    filters.dateTo
  );

  async function save() {
    setSaving(true);
    try {
      await api.post('/audits', {
        title: form.title,
        templateId: form.templateId,
        departmentId: form.departmentId,
        processId: form.processId || null,
        auditorId: form.auditorId || null,
        scheduledDate: form.scheduledDate || null,
      });
      toast.success('Audit scheduled');
      setOpen(false);
      await fetchAudits();
    } catch (err) {
      if (err instanceof RequestError && err.code === 'AUDIT_DUPLICATE_NAME')
        toast.error(t('errors.duplicate_audit_name'));
      else toast.error(err instanceof RequestError ? err.message : 'Could not create audit.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <PageHeader
        title={t('audit.audits_title', 'Audits')}
        description={t('audit.audits_desc')}
        action={
          <Button onClick={() => setOpen(true)}>
            <PlusCircle className="size-4" /> New audit
          </Button>
        }
      />

      {/* Smart search / filter bar */}
      <div className="border-border bg-card flex flex-col gap-3 rounded-lg border p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative flex-1 sm:min-w-[12rem]">
            <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
            <Input
              placeholder={t('audits.search_placeholder', 'Search by name…')}
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              className="pl-8"
            />
          </div>
          <Select
            value={filters.departmentId || 'ALL'}
            onValueChange={(v) => setFilters((f) => ({ ...f, departmentId: v === 'ALL' ? '' : v }))}
          >
            <SelectTrigger className="sm:w-40">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">
                {t('templates.all_departments', 'All departments')}
              </SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.templateId || 'ALL'}
            onValueChange={(v) => setFilters((f) => ({ ...f, templateId: v === 'ALL' ? '' : v }))}
          >
            <SelectTrigger className="sm:w-40">
              <SelectValue placeholder="Template" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t('audits.all_templates', 'All templates')}</SelectItem>
              {templates.map((tpl) => (
                <SelectItem key={tpl.id} value={tpl.id}>
                  {tpl.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.auditorId || 'ALL'}
            onValueChange={(v) => setFilters((f) => ({ ...f, auditorId: v === 'ALL' ? '' : v }))}
          >
            <SelectTrigger className="sm:w-36">
              <SelectValue placeholder="Auditor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t('audits.all_auditors', 'All auditors')}</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.firstName} {u.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.status || 'ALL'}
            onValueChange={(v) => setFilters((f) => ({ ...f, status: v === 'ALL' ? '' : v }))}
          >
            <SelectTrigger className="sm:w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t('templates.all_statuses', 'All statuses')}</SelectItem>
              {AUDIT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <span className="text-muted-foreground text-xs">
            {t('audits.scheduled_between', 'Scheduled between')}:
          </span>
          <DatePicker
            className="sm:w-40"
            value={filters.dateFrom || null}
            onChange={(v) => setFilters((f) => ({ ...f, dateFrom: v ?? '' }))}
            placeholder={t('audits.from', 'From')}
          />
          <DatePicker
            className="sm:w-40"
            value={filters.dateTo || null}
            minDate={filters.dateFrom || null}
            onChange={(v) => setFilters((f) => ({ ...f, dateTo: v ?? '' }))}
            placeholder={t('audits.to', 'To')}
          />
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="text-primary text-xs font-medium hover:underline"
            >
              {t('common.clear_filters', 'Clear all')}
            </button>
          ) : null}
        </div>
      </div>

      <div className="border-border bg-card overflow-hidden rounded-lg border">
        {error ? (
          <ErrorState message={error} onRetry={() => void fetchAudits()} />
        ) : loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-muted h-10 animate-pulse rounded-md" />
            ))}
          </div>
        ) : !audits || audits.items.length === 0 ? (
          <EmptyState
            title={
              hasActiveFilters
                ? t('audits.no_match', 'No audits match your current filters.')
                : t('empty.no_audits', 'No audits')
            }
            description={
              hasActiveFilters
                ? t('templates.adjust_filters', 'Try adjusting or clearing the filters above.')
                : 'Schedule an audit from a published template.'
            }
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-border bg-muted/50 border-b">
              <tr>
                <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium uppercase tracking-wide">
                  Audit
                </th>
                <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium uppercase tracking-wide">
                  Department
                </th>
                <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium uppercase tracking-wide">
                  Progress
                </th>
                <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium uppercase tracking-wide">
                  Compliance
                </th>
                <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium uppercase tracking-wide">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {audits.items.map((audit) => (
                <tr key={audit.id} className="hover:bg-accent/40">
                  <td className="px-4 py-3">
                    <Link
                      href={`/audits/${audit.id}`}
                      className="text-foreground font-medium hover:underline"
                    >
                      {audit.title}
                    </Link>
                    <div className="text-muted-foreground text-xs">{audit.templateName}</div>
                  </td>
                  <td className="text-muted-foreground px-4 py-3">{audit.departmentName ?? '—'}</td>
                  <td className="text-muted-foreground px-4 py-3">{audit.progress}%</td>
                  <td className="text-foreground px-4 py-3 font-medium">
                    {audit.compliance !== null ? `${audit.compliance}%` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_TONE[audit.status] ?? 'secondary'}>{audit.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule an audit</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="a-title">Title</Label>
              <Input
                id="a-title"
                value={form.title}
                onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label>Template</Label>
              <Select
                value={form.templateId}
                onValueChange={(v) => setForm((c) => ({ ...c, templateId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a published template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Department</Label>
              <Select
                value={form.departmentId}
                onValueChange={(v) => setForm((c) => ({ ...c, departmentId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Process (optional)</Label>
              <Select
                value={form.processId || '__none__'}
                onValueChange={(v) =>
                  setForm((c) => ({ ...c, processId: v === '__none__' ? '' : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {processes.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Auditor</Label>
              <Select
                value={form.auditorId || '__none__'}
                onValueChange={(v) =>
                  setForm((c) => ({ ...c, auditorId: v === '__none__' ? '' : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.firstName} {u.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="a-date">Scheduled date</Label>
              <DatePicker
                id="a-date"
                value={form.scheduledDate || null}
                minDate={new Date().toISOString().slice(0, 10)}
                onChange={(v) => setForm((c) => ({ ...c, scheduledDate: v ?? '' }))}
                placeholder="Select date (no past dates)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void save()}
              disabled={saving || !form.title || !form.templateId || !form.departmentId}
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
