'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CalendarClock, Loader2, PlusCircle, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import type {
  DepartmentDto,
  DocumentCategoryDto,
  DocumentDto,
  DocumentStatus,
  PaginatedResult,
} from '@tecpap/types';
import { Badge, Button, Input, Label } from '@tecpap/ui';
import { api, RequestError } from '@/lib/api';
import { useAsync } from '@/lib/use-async';
import { useAuth } from '@/lib/auth-context';
import { useTranslation } from '@/lib/i18n';
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
import { DatePicker } from '@/components/ui/date-picker';
import { ErrorState, PageHeader, TableSkeleton } from '@/components/admin/common';

const STATUS_TONE: Record<
  DocumentStatus,
  'default' | 'secondary' | 'success' | 'warning' | 'danger' | 'outline'
> = {
  DRAFT: 'secondary',
  UNDER_REVIEW: 'warning',
  APPROVED: 'success',
  PUBLISHED: 'success',
  OBSOLETE: 'danger',
  ARCHIVED: 'outline',
};

const STATUS_OPTIONS: DocumentStatus[] = [
  'DRAFT',
  'UNDER_REVIEW',
  'APPROVED',
  'PUBLISHED',
  'OBSOLETE',
  'ARCHIVED',
];
const EXPIRY_OPTIONS = [
  { value: 'ALL', label: 'All' },
  { value: 'EXPIRING_SOON', label: 'Expiring soon' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'NO_EXPIRY', label: 'No expiry' },
] as const;

const DAY_MS = 24 * 3600_000;

interface CreateForm {
  title: string;
  code: string;
  description: string;
  departmentId: string;
  categoryId: string;
  keywords: string;
  effectiveDate: string;
  expirationDate: string;
}

interface FilterState {
  search: string;
  departmentId: string;
  categoryId: string;
  status: string;
  expiry: string;
}

const DEFAULT_FILTERS: FilterState = {
  search: '',
  departmentId: '',
  categoryId: '',
  status: '',
  expiry: '',
};

function isExpiringSoon(doc: DocumentDto): boolean {
  if (!doc.expirationDate) return false;
  const d = new Date(doc.expirationDate).getTime();
  return d > Date.now() && d < Date.now() + 90 * DAY_MS;
}
function isExpired(doc: DocumentDto): boolean {
  if (!doc.expirationDate) return false;
  return new Date(doc.expirationDate).getTime() < Date.now();
}

export default function DocumentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, hasPermission } = useAuth();
  const { t } = useTranslation();
  const isManager = hasPermission('documents.approve');
  const { data: categories } = useAsync<DocumentCategoryDto[]>(() =>
    api.get('/document-categories/active'),
  );

  const [filters, setFilters] = useState<FilterState>(() => ({
    search: searchParams.get('q') ?? '',
    departmentId: searchParams.get('departmentId') ?? '',
    categoryId: searchParams.get('categoryId') ?? '',
    status: searchParams.get('status') ?? '',
    expiry: searchParams.get('expiry') ?? '',
  }));
  const [documents, setDocuments] = useState<PaginatedResult<DocumentDto> | null>(null);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [docsError, setDocsError] = useState<string | null>(null);
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<CreateForm | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<PaginatedResult<DepartmentDto>>('/departments', { pageSize: 100 })
      .then((result) => setDepartments(result.items))
      .catch(() => undefined);
  }, []);

  const fetchDocuments = useCallback(async () => {
    setLoadingDocs(true);
    setDocsError(null);
    try {
      const params: Record<string, string | number | undefined> = { pageSize: 50 };
      const trimmed = filters.search.trim();
      if (trimmed) params.search = trimmed;
      if (filters.departmentId) params.departmentId = filters.departmentId;
      if (filters.categoryId) params.categoryId = filters.categoryId;
      if (filters.status) params.status = filters.status;
      const result = await api.get<PaginatedResult<DocumentDto>>('/documents', params);
      // Client-side expiry filter (backend doesn't have this filter yet)
      let items = result.items;
      if (filters.expiry === 'EXPIRING_SOON') items = items.filter(isExpiringSoon);
      else if (filters.expiry === 'EXPIRED') items = items.filter(isExpired);
      else if (filters.expiry === 'NO_EXPIRY') items = items.filter((d) => !d.expirationDate);
      setDocuments({ ...result, items });
    } catch (err) {
      setDocsError(err instanceof RequestError ? err.message : 'Failed to load documents.');
    } finally {
      setLoadingDocs(false);
    }
  }, [filters]);

  useEffect(() => {
    void fetchDocuments();
    // Persist filters in URL
    const params = new URLSearchParams();
    if (filters.search) params.set('q', filters.search);
    if (filters.departmentId) params.set('departmentId', filters.departmentId);
    if (filters.categoryId) params.set('categoryId', filters.categoryId);
    if (filters.status) params.set('status', filters.status);
    if (filters.expiry) params.set('expiry', filters.expiry);
    const qs = params.toString();
    router.replace(qs ? `/documents?${qs}` : '/documents', { scroll: false });
  }, [fetchDocuments, filters, router]);

  function clearFilters() {
    setFilters(DEFAULT_FILTERS);
  }

  const hasActiveFilters =
    filters.search ||
    filters.departmentId ||
    filters.categoryId ||
    filters.status ||
    filters.expiry;

  function openCreate() {
    // Pilot: department auto-assigned to their own, not changeable
    const pilotDeptId = !isManager && user?.departmentId ? user.departmentId : '';
    setForm({
      title: '',
      code: '',
      description: '',
      departmentId: pilotDeptId || (departments[0]?.id ?? ''),
      categoryId: categories?.[0]?.id ?? '',
      keywords: '',
      effectiveDate: '',
      expirationDate: '',
    });
    setDialogOpen(true);
  }

  async function save() {
    if (!form) return;
    if (
      form.effectiveDate &&
      form.expirationDate &&
      new Date(form.expirationDate) < new Date(form.effectiveDate)
    ) {
      toast.error('Expiry date must be on or after the effective date.');
      return;
    }
    setSaving(true);
    try {
      await api.post<DocumentDto>('/documents', {
        title: form.title,
        code: form.code,
        description: form.description || null,
        departmentId: form.departmentId,
        categoryId: form.categoryId,
        keywords: form.keywords
          ? form.keywords
              .split(',')
              .map((keyword) => keyword.trim())
              .filter(Boolean)
          : [],
        effectiveDate: form.effectiveDate || null,
        expirationDate: form.expirationDate || null,
      });
      toast.success('Document created');
      setDialogOpen(false);
      await fetchDocuments();
    } catch (err) {
      if (err instanceof RequestError && err.code === 'DOCUMENT_DUPLICATE_NAME')
        toast.error(t('errors.duplicate_document_name'));
      else toast.error(err instanceof RequestError ? err.message : 'Could not create document.');
    } finally {
      setSaving(false);
    }
  }

  const deptName = (id: string) => departments.find((d) => d.id === id)?.name ?? id;
  const catName = (id: string) => (categories ?? []).find((c) => c.id === id)?.name ?? id;
  const expiryLabel = EXPIRY_OPTIONS.find((o) => o.value === filters.expiry)?.label ?? '';
  const activeChips = [
    filters.search ? { key: 'search', label: `"${filters.search}"` } : null,
    filters.departmentId ? { key: 'departmentId', label: deptName(filters.departmentId) } : null,
    filters.categoryId ? { key: 'categoryId', label: catName(filters.categoryId) } : null,
    filters.status ? { key: 'status', label: filters.status } : null,
    filters.expiry !== 'ALL' && filters.expiry ? { key: 'expiry', label: expiryLabel } : null,
  ].filter(Boolean) as Array<{ key: string; label: string }>;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <PageHeader
        title="Documents"
        description="Controlled documents organized by department and category."
        action={
          <Button onClick={openCreate}>
            <PlusCircle className="size-4" /> New document
          </Button>
        }
      />

      {/* Enterprise filter bar */}
      <div className="border-border bg-card flex flex-col gap-3 rounded-lg border p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
            <Input
              placeholder="Search by name or code…"
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
              <SelectItem value="ALL">All departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.categoryId || 'ALL'}
            onValueChange={(v) => setFilters((f) => ({ ...f, categoryId: v === 'ALL' ? '' : v }))}
          >
            <SelectTrigger className="sm:w-36">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All categories</SelectItem>
              {(categories ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
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
              <SelectItem value="ALL">All statuses</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.expiry || 'ALL'}
            onValueChange={(v) => setFilters((f) => ({ ...f, expiry: v === 'ALL' ? '' : v }))}
          >
            <SelectTrigger className="sm:w-36">
              <SelectValue placeholder="Expiry" />
            </SelectTrigger>
            <SelectContent>
              {EXPIRY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {/* Filter chips */}
        {activeChips.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {activeChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() =>
                  setFilters((f) => ({ ...f, [chip.key]: chip.key === 'expiry' ? '' : '' }))
                }
                className="border-border bg-muted/50 text-foreground hover:bg-accent inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs"
              >
                {chip.label} <X className="text-muted-foreground size-3" />
              </button>
            ))}
            <button
              type="button"
              onClick={clearFilters}
              className="text-primary ml-1 text-xs font-medium hover:underline"
            >
              Clear all
            </button>
          </div>
        ) : null}
      </div>

      {/* Table */}
      <div className="border-border bg-card overflow-hidden rounded-lg border">
        {docsError ? (
          <ErrorState message={docsError} onRetry={() => void fetchDocuments()} />
        ) : loadingDocs ? (
          <TableSkeleton columns={7} />
        ) : documents && documents.items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-border bg-muted/50 border-b">
                <tr>
                  <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium uppercase tracking-wide">
                    Title
                  </th>
                  <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium uppercase tracking-wide">
                    Code
                  </th>
                  <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium uppercase tracking-wide">
                    Department
                  </th>
                  <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium uppercase tracking-wide">
                    Category
                  </th>
                  <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium uppercase tracking-wide">
                    Effective
                  </th>
                  <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium uppercase tracking-wide">
                    Expiry
                  </th>
                  <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium uppercase tracking-wide">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {documents.items.map((doc) => (
                  <tr key={doc.id} className="hover:bg-accent/40">
                    <td className="px-4 py-3">
                      <Link
                        href={`/documents/${doc.id}`}
                        className="text-foreground font-medium hover:underline"
                      >
                        {doc.title}
                      </Link>
                    </td>
                    <td className="text-muted-foreground px-4 py-3 font-mono text-xs">
                      {doc.code}
                    </td>
                    <td className="text-muted-foreground px-4 py-3">{doc.departmentName ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: doc.categoryColor ?? '#948877' }}
                        />
                        {doc.categoryName}
                      </span>
                    </td>
                    <td className="text-muted-foreground px-4 py-3 text-xs">
                      {doc.effectiveDate ? new Date(doc.effectiveDate).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {doc.expirationDate ? (
                        <span
                          className={`inline-flex items-center gap-1 ${isExpired(doc) ? 'text-destructive font-medium' : isExpiringSoon(doc) ? 'text-warning font-medium' : 'text-muted-foreground'}`}
                        >
                          <CalendarClock className="size-3" />{' '}
                          {new Date(doc.expirationDate).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_TONE[doc.status]}>{doc.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
            <p className="text-foreground text-sm font-medium">
              {hasActiveFilters ? 'No documents match your current filters.' : 'No documents yet'}
            </p>
            <p className="text-muted-foreground text-xs">
              {hasActiveFilters
                ? 'Try adjusting or clearing the filters above.'
                : `${documents?.total ?? 0} document(s). Create one to get started.`}
            </p>
            {hasActiveFilters ? (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear Filters
              </Button>
            ) : null}
          </div>
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New controlled document</DialogTitle>
            <DialogDescription>Register a document in the quality system.</DialogDescription>
          </DialogHeader>
          {form ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => current && { ...current, title: event.target.value })
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="code">Document code</Label>
                <Input
                  id="code"
                  value={form.code}
                  onChange={(event) =>
                    setForm((current) => current && { ...current, code: event.target.value })
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Category</Label>
                <Select
                  value={form.categoryId}
                  onValueChange={(value) =>
                    setForm((current) => current && { ...current, categoryId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {(categories ?? []).map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label>
                  Department{' '}
                  {!isManager && user?.departmentId ? (
                    <span className="text-muted-foreground text-xs">(auto-assigned)</span>
                  ) : null}
                </Label>
                {isManager ? (
                  <Select
                    value={form.departmentId}
                    onValueChange={(value) =>
                      setForm((current) => current && { ...current, departmentId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((department) => (
                        <SelectItem key={department.id} value={department.id}>
                          {department.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={
                      departments.find((d) => d.id === form.departmentId)?.name ?? form.departmentId
                    }
                    disabled
                  />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="effectiveDate">
                  Effective Date <span className="text-muted-foreground text-xs">(optional)</span>
                </Label>
                <DatePicker
                  id="effectiveDate"
                  value={form.effectiveDate || null}
                  onChange={(v) =>
                    setForm((current) => current && { ...current, effectiveDate: v ?? '' })
                  }
                  placeholder="Select effective date"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="expirationDate">
                  Expiry Date{' '}
                  <span className="text-muted-foreground text-xs">
                    (optional — empty = never expires)
                  </span>
                </Label>
                <DatePicker
                  id="expirationDate"
                  value={form.expirationDate || null}
                  minDate={form.effectiveDate || null}
                  onChange={(v) =>
                    setForm((current) => current && { ...current, expirationDate: v ?? '' })
                  }
                  placeholder="Select expiry date"
                />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="keywords">Keywords (comma-separated)</Label>
                <Input
                  id="keywords"
                  value={form.keywords}
                  onChange={(event) =>
                    setForm((current) => current && { ...current, keywords: event.target.value })
                  }
                />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="desc">Description</Label>
                <Textarea
                  id="desc"
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => current && { ...current, description: event.target.value })
                  }
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void save()}
              disabled={
                saving || !form?.title || !form?.code || !form?.categoryId || !form?.departmentId
              }
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Create document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
