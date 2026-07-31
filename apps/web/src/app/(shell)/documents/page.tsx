'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FolderTree, Loader2, PlusCircle, Search } from 'lucide-react';
import { toast } from 'sonner';
import type {
  DepartmentDto,
  DocumentCategoryDto,
  DocumentDto,
  DocumentStatus,
  DocumentTreeNode,
  PaginatedResult,
  ProcessDto,
} from '@tecpap/types';
import { Badge, Button, Input, Label } from '@tecpap/ui';
import { api, RequestError } from '@/lib/api';
import { useAsync } from '@/lib/use-async';
import { DocumentTree, type TreeSelection } from '@/components/documents/document-tree';
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
import { EmptyState, ErrorState, PageHeader, TableSkeleton } from '@/components/admin/common';

const STATUS_TONE: Record<DocumentStatus, 'default' | 'secondary' | 'success' | 'warning' | 'danger' | 'outline'> = {
  DRAFT: 'secondary',
  UNDER_REVIEW: 'warning',
  APPROVED: 'success',
  PUBLISHED: 'success',
  OBSOLETE: 'danger',
  ARCHIVED: 'outline',
};

interface CreateForm {
  title: string;
  code: string;
  description: string;
  departmentId: string;
  processId: string;
  categoryId: string;
  keywords: string;
}

export default function DocumentsPage() {
  const { data: tree, error: treeError, reload: reloadTree } = useAsync<DocumentTreeNode[]>(() => api.get('/documents/tree'));
  const { data: categories } = useAsync<DocumentCategoryDto[]>(() => api.get('/document-categories/active'));

  const [selection, setSelection] = useState<TreeSelection | null>(null);
  const [search, setSearch] = useState('');
  const [documents, setDocuments] = useState<PaginatedResult<DocumentDto> | null>(null);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [docsError, setDocsError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<CreateForm | null>(null);
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [processes, setProcesses] = useState<ProcessDto[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<PaginatedResult<DepartmentDto>>('/departments', { pageSize: 100 }).then((result) => setDepartments(result.items)).catch(() => undefined);
  }, []);

  const fetchDocuments = useCallback(async () => {
    setLoadingDocs(true);
    setDocsError(null);
    try {
      const params: Record<string, string | number | undefined> = { pageSize: 50 };
      if (selection?.departmentId) params.departmentId = selection.departmentId;
      if (selection?.processId) params.processId = selection.processId;
      if (selection?.categoryId) params.categoryId = selection.categoryId;
      const trimmed = search.trim();
      if (trimmed) params.search = trimmed;
      const result = await api.get<PaginatedResult<DocumentDto>>('/documents', params);
      setDocuments(result);
    } catch (err) {
      setDocsError(err instanceof RequestError ? err.message : 'Failed to load documents.');
    } finally {
      setLoadingDocs(false);
    }
  }, [selection, search]);

  useEffect(() => {
    void fetchDocuments();
  }, [fetchDocuments]);

  function openCreate() {
    setForm({
      title: '',
      code: '',
      description: '',
      departmentId: selection?.departmentId ?? departments[0]?.id ?? '',
      processId: selection?.processId ?? '',
      categoryId: categories?.[0]?.id ?? '',
      keywords: '',
    });
    setDialogOpen(true);
  }

  // Load processes for the selected department in the create form.
  useEffect(() => {
    if (!form?.departmentId) {
      setProcesses([]);
      return;
    }
    api.get<PaginatedResult<ProcessDto>>('/processes', { pageSize: 100, departmentId: form.departmentId })
      .then((result) => setProcesses(result.items))
      .catch(() => setProcesses([]));
  }, [form?.departmentId]);

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      await api.post<DocumentDto>('/documents', {
        title: form.title,
        code: form.code,
        description: form.description || null,
        departmentId: form.departmentId,
        processId: form.processId || null,
        categoryId: form.categoryId,
        keywords: form.keywords ? form.keywords.split(',').map((keyword) => keyword.trim()).filter(Boolean) : [],
      });
      toast.success('Document created');
      setDialogOpen(false);
      await Promise.all([fetchDocuments(), reloadTree()]);
    } catch (err) {
      toast.error(err instanceof RequestError ? err.message : 'Could not create document.');
    } finally {
      setSaving(false);
    }
  }

  const total = documents?.total ?? 0;
  const headerLabel = useMemo(() => selection?.label ?? 'All documents', [selection]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <PageHeader
        title="Documents"
        description="Controlled documents organized by department, process and category."
        action={
          <Button onClick={openCreate}>
            <PlusCircle className="size-4" /> New document
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <aside className="rounded-lg border border-border bg-card p-3 lg:max-h-[70vh] lg:overflow-y-auto scrollbar-thin">
          <div className="mb-2 flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <FolderTree className="size-4" /> Library
          </div>
          {treeError ? (
            <button className="px-2 text-xs text-destructive underline" onClick={reloadTree}>Reload tree</button>
          ) : !tree ? (
            <div className="space-y-2 px-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-5 animate-pulse rounded bg-muted" />)}</div>
          ) : (
            <DocumentTree nodes={tree} selection={selection} onSelect={(next) => setSelection((current) => (current?.label === next.label ? null : next))} />
          )}
        </aside>

        <section className="flex flex-col gap-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder={`Search in "${headerLabel}"…`} value={search} onChange={(event) => setSearch(event.target.value)} className="pl-8" />
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-card">
            {docsError ? (
              <ErrorState message={docsError} onRetry={() => void fetchDocuments()} />
            ) : loadingDocs ? (
              <TableSkeleton columns={4} />
            ) : documents && documents.items.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Title</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Code</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Category</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Version</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {documents.items.map((doc) => (
                      <tr key={doc.id} className="hover:bg-accent/40">
                        <td className="px-4 py-3">
                          <Link href={`/documents/${doc.id}`} className="font-medium text-foreground hover:underline">{doc.title}</Link>
                          {doc.processName ? <div className="text-xs text-muted-foreground">{doc.processName}</div> : null}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{doc.code}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="size-2 rounded-full" style={{ backgroundColor: doc.categoryColor ?? '#948877' }} />
                            {doc.categoryName}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{doc.version}</td>
                        <td className="px-4 py-3"><Badge variant={STATUS_TONE[doc.status]}>{doc.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No documents here" description={`${total} document(s). Create one or pick another node in the tree.`} />
            )}
          </div>
        </section>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New controlled document</DialogTitle>
            <DialogDescription>Register a document in the quality system.</DialogDescription>
          </DialogHeader>
          {form ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2 sm:col-span-2"><Label htmlFor="title">Title</Label><Input id="title" value={form.title} onChange={(event) => setForm((current) => current && ({ ...current, title: event.target.value }))} /></div>
              <div className="flex flex-col gap-2"><Label htmlFor="code">Document code</Label><Input id="code" value={form.code} onChange={(event) => setForm((current) => current && ({ ...current, code: event.target.value }))} /></div>
              <div className="flex flex-col gap-2">
                <Label>Category</Label>
                <Select value={form.categoryId} onValueChange={(value) => setForm((current) => current && ({ ...current, categoryId: value }))}>
                  <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                  <SelectContent>{(categories ?? []).map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Department</Label>
                <Select value={form.departmentId} onValueChange={(value) => setForm((current) => current && ({ ...current, departmentId: value, processId: '' }))}>
                  <SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger>
                  <SelectContent>{departments.map((department) => <SelectItem key={department.id} value={department.id}>{department.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Process (optional)</Label>
                <Select value={form.processId || '__none__'} onValueChange={(value) => setForm((current) => current && ({ ...current, processId: value === '__none__' ? '' : value }))}>
                  <SelectTrigger><SelectValue placeholder="No process" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No process</SelectItem>
                    {processes.map((process) => <SelectItem key={process.id} value={process.id}>{process.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2"><Label htmlFor="keywords">Keywords (comma-separated)</Label><Input id="keywords" value={form.keywords} onChange={(event) => setForm((current) => current && ({ ...current, keywords: event.target.value }))} /></div>
              <div className="flex flex-col gap-2 sm:col-span-2"><Label htmlFor="desc">Description</Label><Textarea id="desc" value={form.description} onChange={(event) => setForm((current) => current && ({ ...current, description: event.target.value }))} /></div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => void save()} disabled={saving || !form?.title || !form?.code || !form?.categoryId || !form?.departmentId}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Create document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
