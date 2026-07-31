'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, PlusCircle, Search } from 'lucide-react';
import { toast } from 'sonner';
import type { CapaDto, DepartmentDto, PaginatedResult } from '@tecpap/types';
import { Badge, Button, Input, Label } from '@tecpap/ui';
import { api, RequestError } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState, ErrorState, PageHeader } from '@/components/admin/common';

const STATUS_TONE: Record<string, 'secondary' | 'warning' | 'success' | 'danger' | 'outline'> = {
  DRAFT: 'secondary', ROOT_CAUSE_ANALYSIS: 'secondary', ACTION_PLAN: 'secondary', IN_PROGRESS: 'warning',
  PENDING_VERIFICATION: 'outline', PENDING_EFFECTIVENESS: 'outline', CLOSED: 'success', CANCELLED: 'danger',
};

export default function CapasPage() {
  const { t } = useTranslation();
  const [capas, setCapas] = useState<PaginatedResult<CapaDto> | null>(null);
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', departmentId: '', priority: 'MEDIUM', targetDate: '' });
  const [saving, setSaving] = useState(false);

  const fetchCapas = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params: Record<string, string | undefined> = { pageSize: '50', search: search.trim() || undefined };
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (overdueOnly) params.overdue = 'true';
      setCapas(await api.get<PaginatedResult<CapaDto>>('/capas', params));
    } catch (err) { setError(err instanceof RequestError ? err.message : t('capa.failed_load')); }
    finally { setLoading(false); }
  }, [search, statusFilter, overdueOnly, t]);

  useEffect(() => {
    void fetchCapas();
    api.get<PaginatedResult<DepartmentDto>>('/departments', { pageSize: 100 }).then((r) => setDepartments(r.items)).catch(() => undefined);
  }, [fetchCapas]);

  async function save() {
    setSaving(true);
    try {
      await api.post('/capas', { title: form.title, description: form.description || null, departmentId: form.departmentId, priority: form.priority, targetDate: form.targetDate || undefined, sourceType: 'MANUAL' });
      toast.success(t('capa.created')); setDialogOpen(false); setForm({ title: '', description: '', departmentId: departments[0]?.id ?? '', priority: 'MEDIUM', targetDate: '' }); await fetchCapas();
    } catch (err) { toast.error(err instanceof RequestError ? err.message : t('capa.create_failed')); }
    finally { setSaving(false); }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <PageHeader title={t('capa.title')} description={t('capa.description')} action={<Button onClick={() => { setForm({ title: '', description: '', departmentId: departments[0]?.id ?? '', priority: 'MEDIUM', targetDate: '' }); setDialogOpen(true); }}><PlusCircle className="size-4" /> {t('capa.new')}</Button>} />
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder={t('common.search', 'Search')} className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">{t('filter.all_statuses')}</SelectItem>{['DRAFT', 'ROOT_CAUSE_ANALYSIS', 'ACTION_PLAN', 'IN_PROGRESS', 'PENDING_VERIFICATION', 'PENDING_EFFECTIVENESS', 'CLOSED', 'CANCELLED'].map((s) => <SelectItem key={s} value={s}>{t(`status.${s}`, s)}</SelectItem>)}</SelectContent></Select>
        <Button variant={overdueOnly ? 'default' : 'outline'} size="sm" onClick={() => setOverdueOnly((v) => !v)}>{t('capa.overdue')}</Button>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {error ? <ErrorState message={error} onRetry={() => void fetchCapas()} /> : loading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-md bg-muted" />)}</div>
        ) : !capas || capas.items.length === 0 ? <EmptyState title={t('capa.no_capas')} /> : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50"><tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('capa.reference')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('common.title')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('table.department')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('table.status')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('capa.priority')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('common.actions')}</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {capas.items.map((capa) => (
                <tr key={capa.id} className="hover:bg-accent/40">
                  <td className="px-4 py-3"><Badge variant="outline" className="font-mono text-xs">{capa.referenceNumber}</Badge>{capa.isOverdue ? <Badge variant="danger" className="ml-1 text-[10px]">!</Badge> : null}</td>
                  <td className="px-4 py-3"><Link href={`/capas/${capa.id}`} className="font-medium text-foreground hover:underline">{capa.title}</Link></td>
                  <td className="px-4 py-3 text-muted-foreground">{capa.departmentName ?? '—'}</td>
                  <td className="px-4 py-3"><Badge variant={STATUS_TONE[capa.status] ?? 'secondary'}>{t(`status.${capa.status}`, capa.status)}</Badge></td>
                  <td className="px-4 py-3"><Badge variant={capa.priority === 'CRITICAL' ? 'danger' : capa.priority === 'HIGH' ? 'warning' : 'secondary'}>{t(`priority.${capa.priority}`, capa.priority)}</Badge></td>
                  <td className="px-4 py-3 text-muted-foreground">{capa.completedActionCount}/{capa.actionCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('capa.new')} CAPA</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2 sm:col-span-2"><Label htmlFor="c-title">{t('common.title', 'Title')}</Label><Input id="c-title" value={form.title} onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))} /></div>
            <div className="flex flex-col gap-2"><Label>{t('common.department', 'Department')}</Label><Select value={form.departmentId} onValueChange={(v) => setForm((c) => ({ ...c, departmentId: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="flex flex-col gap-2"><Label>{t('capa.priority')}</Label><Select value={form.priority} onValueChange={(v) => setForm((c) => ({ ...c, priority: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((p) => <SelectItem key={p} value={p}>{t(`priority.${p}`, p)}</SelectItem>)}</SelectContent></Select></div>
            <div className="flex flex-col gap-2"><Label htmlFor="c-date">{t('capa.target_date')}</Label><Input id="c-date" type="date" value={form.targetDate} onChange={(e) => setForm((c) => ({ ...c, targetDate: e.target.value }))} /></div>
            <div className="flex flex-col gap-2 sm:col-span-2"><Label htmlFor="c-desc">{t('common.description', 'Description')}</Label><Textarea id="c-desc" value={form.description} onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel', 'Cancel')}</Button><Button onClick={() => void save()} disabled={saving || !form.title || !form.departmentId}>{saving ? <Loader2 className="size-4 animate-spin" /> : null}{t('common.create', 'Create')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
