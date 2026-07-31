'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Pencil, PlusCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { DocumentCategoryDto, PaginatedResult } from '@tecpap/types';
import { Badge, Button, Input, Label } from '@tecpap/ui';
import { api, RequestError } from '@/lib/api';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState, ErrorState, PageHeader } from '@/components/admin/common';
import { useTranslation } from '@/lib/i18n';

interface CategoryForm {
  code: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  active: boolean;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<DocumentCategoryDto[]>([]);
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DocumentCategoryDto | null>(null);
  const [form, setForm] = useState<CategoryForm | null>(null);
  const [saving, setSaving] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<PaginatedResult<DocumentCategoryDto>>('/document-categories', { pageSize: 100 });
      setCategories(result.items);
    } catch (err) {
      setError(err instanceof RequestError ? err.message : 'Failed to load categories.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetch(); }, [fetch]);

  function openCreate() { setEditing(null); setForm({ code: '', name: '', icon: 'FileText', color: '#5B8A1E', description: '', active: true }); setDialogOpen(true); }
  function openEdit(category: DocumentCategoryDto) { setEditing(category); setForm({ code: category.code, name: category.name, icon: category.icon ?? '', color: category.color ?? '#5B8A1E', description: category.description ?? '', active: category.active }); setDialogOpen(true); }

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      const body = { code: form.code.toUpperCase(), name: form.name, icon: form.icon || null, color: form.color || null, description: form.description || null, active: form.active };
      if (editing) { await api.patch(`/document-categories/${editing.id}`, body); toast.success('Category updated'); }
      else { await api.post('/document-categories', body); toast.success('Category created'); }
      setDialogOpen(false);
      await fetch();
    } catch (err) {
      toast.error(err instanceof RequestError ? err.message : 'Could not save category.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageHeader title={t('page.categories', 'Document categories')} description={t('page.categories_desc')} action={<Button onClick={openCreate}><PlusCircle className="size-4" /> New category</Button>} />

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {error ? <ErrorState message={error} onRetry={() => void fetch()} /> : loading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-md bg-muted" />)}</div>
        ) : categories.length === 0 ? <EmptyState title={t('empty.no_categories', 'No categories')} /> : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Color</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Documents</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Active</th>
                <th className="w-10 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {categories.map((category) => (
                <tr key={category.id}>
                  <td className="px-4 py-3"><span className="inline-block size-4 rounded-full" style={{ backgroundColor: category.color ?? '#948877' }} /></td>
                  <td className="px-4 py-3"><Badge variant="outline" className="font-mono">{category.code}</Badge></td>
                  <td className="px-4 py-3 font-medium text-foreground">{category.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{category.documentCount}</td>
                  <td className="px-4 py-3"><Badge variant={category.active ? 'success' : 'secondary'}>{category.active ? 'Active' : 'Inactive'}</Badge></td>
                  <td className="px-4 py-3 text-right"><Button variant="ghost" size="icon" onClick={() => openEdit(category)} aria-label="Edit"><Pencil className="size-4" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit category' : 'New category'}</DialogTitle><DialogDescription>{editing ? 'Update the category.' : 'Create a document category.'}</DialogDescription></DialogHeader>
          {form ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2"><Label htmlFor="ccode">Code</Label><Input id="ccode" value={form.code} onChange={(e) => setForm((c) => c && ({ ...c, code: e.target.value.toUpperCase() }))} disabled={!!editing} /></div>
              <div className="flex flex-col gap-2"><Label htmlFor="cname">Name</Label><Input id="cname" value={form.name} onChange={(e) => setForm((c) => c && ({ ...c, name: e.target.value }))} /></div>
              <div className="flex flex-col gap-2"><Label htmlFor="cicon">Icon (lucide name)</Label><Input id="cicon" value={form.icon} onChange={(e) => setForm((c) => c && ({ ...c, icon: e.target.value }))} /></div>
              <div className="flex flex-col gap-2"><Label htmlFor="ccolor">Color</Label><div className="flex items-center gap-2"><input type="color" value={form.color} onChange={(e) => setForm((c) => c && ({ ...c, color: e.target.value }))} className="size-9 rounded border border-border" /><Input value={form.color} onChange={(e) => setForm((c) => c && ({ ...c, color: e.target.value }))} /></div></div>
              <div className="flex flex-col gap-2 sm:col-span-2"><Label htmlFor="cdesc">Description</Label><Textarea id="cdesc" value={form.description} onChange={(e) => setForm((c) => c && ({ ...c, description: e.target.value }))} /></div>
              <label className="flex items-center gap-2 text-sm sm:col-span-2"><Checkbox checked={form.active} onCheckedChange={(v) => setForm((c) => c && ({ ...c, active: v === true }))} /> Active</label>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => void save()} disabled={saving || !form?.code || !form?.name}>{saving ? <Loader2 className="size-4 animate-spin" /> : null}{editing ? 'Save' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
