'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, FileText, GitBranch, Loader2, RotateCw, Trash2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { ImportJobDetailDto, ImportItemDto, ReviewDecision } from '@tecpap/types';
import { Badge, Button, Input, Label } from '@tecpap/ui';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api, RequestError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useTranslation } from '@/lib/i18n';
import { ErrorState } from '@/components/admin/common';

const JOB_TONE: Record<string, 'secondary' | 'warning' | 'success' | 'danger' | 'outline'> = {
  PENDING: 'secondary', SCANNING: 'warning', PARSING: 'warning', CLASSIFYING: 'warning',
  WAITING_REVIEW: 'outline', IMPORTING: 'warning', COMPLETED: 'success', FAILED: 'danger', CANCELLED: 'secondary',
};
const ITEM_TONE: Record<string, 'secondary' | 'warning' | 'success' | 'danger' | 'outline'> = {
  PENDING: 'secondary', PARSED: 'secondary', CLASSIFIED: 'outline', DUPLICATE: 'warning',
  AWAITING_REVIEW: 'outline', APPROVED: 'success', REJECTED: 'danger', IMPORTED: 'success', FAILED: 'danger', SKIPPED: 'secondary',
};
const ACTIVE = ['PENDING', 'SCANNING', 'PARSING', 'CLASSIFYING', 'WAITING_REVIEW', 'IMPORTING'];

export default function ImportJobDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const [job, setJob] = useState<ImportJobDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<{ item: ImportItemDto; departmentCode: string; categoryCode: string; title: string; code: string; note: string } | null>(null);
  const lastProgress = useRef<string>('');

  const canReview = hasPermission('imports.review');
  const canManage = hasPermission('imports.cancel');

  const load = useCallback(async () => {
    try { setJob(await api.get<ImportJobDetailDto>(`/import/${id}`)); setError(null); }
    catch (err) { setError(err instanceof RequestError ? err.message : 'Failed to load.'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  // Poll while the job is active.
  useEffect(() => {
    if (!job || !ACTIVE.includes(job.status)) return;
    const h = setInterval(async () => {
      try {
        const p = await api.get<{ status: string; progress: number; processed: number }>(`/import/${id}/progress`);
        const sig = `${p.status}:${p.progress}:${p.processed}`;
        if (sig !== lastProgress.current) { lastProgress.current = sig; await load(); }
      } catch { /* ignore transient poll errors */ }
    }, 3000);
    return () => clearInterval(h);
  }, [job, id, load]);

  async function act(path: string, successMsg: string, method: 'post' | 'delete' = 'post') {
    setBusy(true);
    try { await (method === 'delete' ? api.delete(path) : api.post(path)); toast.success(successMsg); await load(); }
    catch (err) { toast.error(err instanceof RequestError ? err.message : 'Failed.'); }
    finally { setBusy(false); }
  }

  async function submitReview(decision: ReviewDecision) {
    if (!review) return;
    setBusy(true);
    try {
      const overrides: Record<string, string> = {};
      if (review.departmentCode) overrides.departmentCode = review.departmentCode;
      if (review.categoryCode) overrides.categoryCode = review.categoryCode;
      if (review.title) overrides.title = review.title;
      if (review.code) overrides.code = review.code;
      await api.post(`/import/items/${review.item.id}/review`, { decision, overrides, note: review.note || undefined });
      toast.success(`${decision} ✓`); setReview(null); await load();
    } catch (err) { toast.error(err instanceof RequestError ? err.message : 'Failed.'); }
    finally { setBusy(false); }
  }

  if (loading) return <div className="mx-auto max-w-6xl p-8 text-sm text-muted-foreground">Loading…</div>;
  if (error || !job) return <div className="mx-auto max-w-6xl"><ErrorState message={error ?? 'Not found'} /></div>;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <Link href="/import" className="text-xs text-muted-foreground hover:underline"><span className="inline-flex items-center gap-1"><ArrowLeft className="size-3" /> {t('import.jobs')}</span></Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant={JOB_TONE[job.status] ?? 'secondary'}>{t(`import.status.${job.status}`, job.status)}</Badge>
            {ACTIVE.includes(job.status) ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
          </div>
          <h1 className="mt-1 text-xl font-semibold text-foreground">{job.name ?? job.sourceLocation ?? 'Import job'}</h1>
          <p className="text-xs text-muted-foreground">{job.source}{job.sourceLocation ? ` · ${job.sourceLocation}` : ''} · {new Date(job.createdAt).toLocaleString()}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canReview && job.items.some((i) => i.status === 'AWAITING_REVIEW') ? <Button size="sm" onClick={() => void act(`/import/${id}/approve-all`, t('import.approve_all'))} disabled={busy}><CheckCircle2 className="size-4" /> {t('import.approve_all')}</Button> : null}
          {canReview ? <Button size="sm" variant="outline" onClick={() => void act(`/import/${id}/relationships`, 'Relationships')} disabled={busy}><GitBranch className="size-4" /></Button> : null}
          {canManage && job.failed > 0 ? <Button size="sm" variant="outline" onClick={() => void act(`/import/${id}/retry`, t('import.retry'))} disabled={busy}><RotateCw className="size-4" /> {t('import.retry')}</Button> : null}
          {canManage && ACTIVE.includes(job.status) ? <Button size="sm" variant="outline" onClick={() => void act(`/import/${id}/cancel`, t('import.cancel'))} disabled={busy}>{t('import.cancel')}</Button> : null}
          {canManage ? <Button size="sm" variant="ghost" onClick={() => void act(`/import/${id}`, t('import.delete_job'), 'delete')} disabled={busy}><Trash2 className="size-4" /></Button> : null}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground"><span>{t('import.progress')}</span><span>{job.progress}%</span></div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${job.progress}%` }} /></div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
          <Counter label={t('import.processed')} value={job.processed} />
          <Counter label={t('import.imported')} value={job.imported} tone="text-success-fg" />
          <Counter label={t('import.pending_review')} value={job.items.filter((i) => i.status === 'AWAITING_REVIEW').length} tone="text-warning-fg" />
          <Counter label={t('import.duplicates')} value={job.duplicates} />
          <Counter label={t('import.failed')} value={job.failed} tone="text-danger-fg" />
          <Counter label={t('common.status')} value={job.items.filter((i) => i.status === 'SKIPPED').length} />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3 text-sm font-semibold">{t('import.items')} ({job.items.length})</div>
        <div className="divide-y divide-border">
          {job.items.map((item) => (
            <div key={item.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[10px] uppercase">{item.format}</Badge>
                  <Badge variant={ITEM_TONE[item.status] ?? 'secondary'} className="text-[10px]">{item.status}</Badge>
                  {item.targetEntityType === 'AUDIT_TEMPLATE' ? <Badge variant="success" className="text-[10px]">{t('import.target')}: Template</Badge> : null}
                  {item.importedEntityType === 'audit_template' ? <Badge variant="success" className="text-[10px]">AuditTemplate</Badge> : null}
                  <span className="truncate font-medium text-foreground">{item.fileName}</span>
                </div>
                <div className="mt-1 truncate text-xs text-muted-foreground" title={item.originalPath}>{t('import.original_path')}: {item.originalPath}</div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {item.classification?.departmentCode ? <span>{t('import.by_department')}: <strong>{item.classification.departmentCode}</strong></span> : null}
                  {item.classification?.categoryCode ? <span>{t('import.by_category')}: <strong>{item.classification.categoryCode}</strong></span> : null}
                  {item.classification ? <span>{t('import.confidence')}: {Math.round(item.classification.confidence * 100)}%</span> : null}
                  {item.detectedType ? <span>{t('import.detected_type')}: {item.detectedType}</span> : null}
                  {item.ocrNeeded ? <span className="text-warning-fg">OCR</span> : null}
                  {item.warnings?.length ? <span className="text-warning-fg">⚠ {item.warnings.length}</span> : null}
                  {item.error ? <span className="text-danger-fg">{item.error}</span> : null}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-1">
                {item.status === 'AWAITING_REVIEW' && canReview ? (
                  <>
                    <Button size="sm" onClick={() => setReview({ item, departmentCode: item.classification?.departmentCode ?? '', categoryCode: item.classification?.categoryCode ?? '', title: '', code: '', note: '' })}>{t('import.approve')}</Button>
                    <Button size="sm" variant="outline" onClick={() => void api.post(`/import/items/${item.id}/review`, { decision: 'REJECT' }).then(() => load()).catch((e) => toast.error(e instanceof RequestError ? e.message : 'Failed.'))}><XCircle className="size-3.5" /></Button>
                  </>
                ) : null}
                {item.status === 'DUPLICATE' && canReview ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setReview({ item, departmentCode: item.classification?.departmentCode ?? '', categoryCode: item.classification?.categoryCode ?? '', title: '', code: '', note: '' })}>{t('import.replace_version')}</Button>
                    <Button size="sm" variant="ghost" onClick={() => void api.post(`/import/items/${item.id}/review`, { decision: 'MERGE' }).then(() => load()).catch((e) => toast.error(e instanceof RequestError ? e.message : 'Failed.'))}>{t('import.merge')}</Button>
                  </>
                ) : null}
                {item.status === 'IMPORTED' && item.importedEntityId ? (
                  <Link href={item.importedEntityType === 'audit_template' ? `/audit-templates/${item.importedEntityId}` : `/documents/${item.importedEntityId}`} className="inline-flex h-8 items-center rounded-md px-2 text-muted-foreground hover:bg-accent hover:text-foreground"><FileText className="size-3.5" /></Link>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={!!review} onOpenChange={(o) => !o && setReview(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('import.metadata')} · {review?.item.fileName}</DialogTitle></DialogHeader>
          {review ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t('common.title')}><Input value={review.title} placeholder={review.item.fileName} onChange={(e) => setReview({ ...review, title: e.target.value })} /></Field>
              <Field label="Code"><Input value={review.code} onChange={(e) => setReview({ ...review, code: e.target.value })} /></Field>
              <Field label={t('import.by_department')}><Input value={review.departmentCode} placeholder="PROD" onChange={(e) => setReview({ ...review, departmentCode: e.target.value.toUpperCase() })} /></Field>
              <Field label={t('import.by_category')}><Input value={review.categoryCode} placeholder="PROCEDURE" onChange={(e) => setReview({ ...review, categoryCode: e.target.value.toUpperCase() })} /></Field>
              <div className="sm:col-span-2"><Field label={t('common.description')}><Textarea value={review.note} onChange={(e) => setReview({ ...review, note: e.target.value })} /></Field></div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReview(null)}>{t('common.cancel')}</Button>
            {review?.item.status === 'DUPLICATE' ? <Button variant="outline" onClick={() => void submitReview('REPLACE_VERSION')} disabled={busy}>{t('import.replace_version')}</Button> : null}
            <Button onClick={() => void submitReview('APPROVE')} disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} {t('import.approve')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Counter({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return <div><div className={`text-lg font-semibold ${tone ?? ''}`}>{value}</div><div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div></div>;
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex flex-col gap-1"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}
