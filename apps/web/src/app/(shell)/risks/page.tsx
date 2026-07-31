'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, PlusCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { PaginatedResult, ProcessDto, ProcessRiskDto } from '@tecpap/types';
import { Badge, Button, Input, Label } from '@tecpap/ui';
import { api, RequestError } from '@/lib/api';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState, ErrorState, PageHeader } from '@/components/admin/common';
import { useTranslation } from '@/lib/i18n';

const LEVELS = [1, 2, 3, 4, 5];

export default function RisksPage() {
  const [risks, setRisks] = useState<ProcessRiskDto[]>([]);
  const { t } = useTranslation();
  const [processes, setProcesses] = useState<ProcessDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ processId: '', title: '', probability: '3', impact: '3', mitigation: '' });
  const [saving, setSaving] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<PaginatedResult<ProcessRiskDto>>('/process-risks', { pageSize: 100 });
      setRisks(result.items);
    } catch (err) {
      setError(err instanceof RequestError ? err.message : 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetch();
    api.get<PaginatedResult<ProcessDto>>('/processes', { pageSize: 100 }).then((r) => setProcesses(r.items)).catch(() => undefined);
  }, [fetch]);

  async function save() {
    setSaving(true);
    try {
      await api.post('/process-risks', { processId: form.processId, title: form.title, probability: Number(form.probability), impact: Number(form.impact), mitigation: form.mitigation || null });
      toast.success('Risk registered');
      setOpen(false);
      setForm({ processId: processes[0]?.id ?? '', title: '', probability: '3', impact: '3', mitigation: '' });
      await fetch();
    } catch (err) {
      toast.error(err instanceof RequestError ? err.message : 'Could not create risk.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <PageHeader title={t('page.risks', 'Process risks')} description={t('page.risks_desc')} action={<Button onClick={() => { setForm({ processId: processes[0]?.id ?? '', title: '', probability: '3', impact: '3', mitigation: '' }); setOpen(true); }}><PlusCircle className="size-4" /> New risk</Button>} />

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {error ? <ErrorState message={error} onRetry={() => void fetch()} /> : loading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-md bg-muted" />)}</div>
        ) : risks.length === 0 ? <EmptyState title={t('empty.no_risks', 'No risks')} /> : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Risk</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Process</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">P × I</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Score</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {risks.map((risk) => (
                <tr key={risk.id}>
                  <td className="px-4 py-3 font-medium text-foreground">{risk.title}</td>
                  <td className="px-4 py-3 text-muted-foreground"><Link href={`/processes/${risk.processId}`} className="hover:underline">{risk.ownerName ?? '—'}</Link></td>
                  <td className="px-4 py-3 text-muted-foreground">{risk.probability} × {risk.impact}</td>
                  <td className="px-4 py-3"><Badge variant={risk.riskScore >= 15 ? 'danger' : risk.riskScore >= 8 ? 'warning' : 'secondary'}>{risk.riskScore}</Badge></td>
                  <td className="px-4 py-3"><Badge variant={risk.status === 'OPEN' ? 'warning' : 'secondary'}>{risk.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New risk</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label>Process</Label>
              <Select value={form.processId} onValueChange={(value) => setForm((current) => ({ ...current, processId: value }))}><SelectTrigger><SelectValue placeholder="Process" /></SelectTrigger><SelectContent>{processes.map((process) => <SelectItem key={process.id} value={process.id}>{process.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2"><Label htmlFor="r-title">Title</Label><Input id="r-title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></div>
            <div className="flex flex-col gap-2">
              <Label>Probability</Label>
              <Select value={form.probability} onValueChange={(value) => setForm((current) => ({ ...current, probability: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{LEVELS.map((level) => <SelectItem key={level} value={String(level)}>{level}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Impact</Label>
              <Select value={form.impact} onValueChange={(value) => setForm((current) => ({ ...current, impact: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{LEVELS.map((level) => <SelectItem key={level} value={String(level)}>{level}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2"><Label htmlFor="r-mit">Mitigation</Label><Textarea id="r-mit" value={form.mitigation} onChange={(event) => setForm((current) => ({ ...current, mitigation: event.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => void save()} disabled={saving || !form.title || !form.processId}>{saving ? <Loader2 className="size-4 animate-spin" /> : null}Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
