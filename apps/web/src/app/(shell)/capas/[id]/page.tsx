'use client';

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CheckCircle2, Download, Loader2, PlusCircle, Upload } from 'lucide-react';
import { toast } from 'sonner';
import type { CapaDetailDto } from '@tecpap/types';
import { Badge, Button, Input, Label } from '@tecpap/ui';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { api, getAccessToken, RequestError, uploadFile } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useTranslation } from '@/lib/i18n';
import { ErrorState } from '@/components/admin/common';
import { VerificationHistoryList } from '@/components/capa/verification-history-list';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';
const STATUS_TONE: Record<string, 'secondary' | 'warning' | 'success' | 'danger' | 'outline'> = { DRAFT: 'secondary', ROOT_CAUSE_ANALYSIS: 'secondary', ACTION_PLAN: 'secondary', IN_PROGRESS: 'warning', PENDING_VERIFICATION: 'outline', PENDING_EFFECTIVENESS: 'outline', CLOSED: 'success', CANCELLED: 'danger', ASSIGNED: 'secondary', EVIDENCE_UPLOADED: 'outline', RETURNED: 'danger', VALIDATED: 'success' };

const WORKFLOW_STAGES = ['ASSIGNED', 'IN_PROGRESS', 'EVIDENCE_UPLOADED', 'AWAITING_VERIFICATION', 'RETURNED', 'VALIDATED', 'CLOSED'] as const;

export default function CapaWorkspacePage() {
  const params = useParams();
  const id = params?.id as string;
  const { hasPermission } = useAuth();
  const { t } = useTranslation();
  const [capa, setCapa] = useState<CapaDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionForm, setActionForm] = useState({ title: '', actionType: 'CORRECTIVE', dueDate: '' });
  const [rootCause, setRootCause] = useState({ problemStatement: '', immediateCause: '', rootCause: '', contributingFactors: '' });
  const [verificationResult, setVerificationResult] = useState('PASSED');
  const [verificationNotes, setVerificationNotes] = useState('');
  const [effectivenessResult, setEffectivenessResult] = useState('EFFECTIVE');
  const [effectivenessNotes, setEffectivenessNotes] = useState('');
  const [closureComment, setClosureComment] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [evidenceActionId, setEvidenceActionId] = useState('');

  const statusLabel = (s: string) => t(`status.${s}`, s);
  const priorityLabel = (p: string) => t(`priority.${p}`, p);
  const actionTypeLabel = (a: string) => (a === 'CONTAINMENT' ? t('capa.containment') : a === 'CORRECTIVE' ? t('capa.corrective') : a === 'PREVENTIVE' ? t('capa.preventive') : a);
  const resultLabel = (r: string) => (r === 'PASSED' ? t('capa.result_passed') : r === 'FAILED' ? t('capa.result_failed') : r === 'EFFECTIVE' ? t('capa.result_effective') : r === 'PARTIALLY_EFFECTIVE' ? t('capa.result_partially_effective') : r === 'INEFFECTIVE' ? t('capa.result_ineffective') : r);

  const reload = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const detail = await api.get<CapaDetailDto>(`/capas/${id}`);
      setCapa(detail);
      if (detail.rootCause) { setRootCause({ problemStatement: detail.rootCause.problemStatement ?? '', immediateCause: detail.rootCause.immediateCause ?? '', rootCause: detail.rootCause.rootCause ?? '', contributingFactors: detail.rootCause.contributingFactors ?? '' }); }
    } catch (err) { setError(err instanceof RequestError ? err.message : t('capa.failed_load')); }
    finally { setLoading(false); }
  }, [id, t]);

  useEffect(() => { void reload(); }, [reload]);

  async function transition(target: string) { setBusy(true); try { await api.post(`/capas/${id}/transition`, { status: target }); toast.success(t('capa.status_updated')); await reload(); } catch (err) { toast.error(err instanceof RequestError ? err.message : t('capa.failed')); } finally { setBusy(false); } }
  async function submit() { setBusy(true); try { await api.post(`/capas/${id}/submit`); toast.success(t('capa.submit')); await reload(); } catch (err) { toast.error(err instanceof RequestError ? err.message : t('capa.failed')); } finally { setBusy(false); } }
  async function rework() { setBusy(true); try { await api.post(`/capas/${id}/rework`); toast.success(t('capa.rework')); await reload(); } catch (err) { toast.error(err instanceof RequestError ? err.message : t('capa.failed')); } finally { setBusy(false); } }
  async function saveRootCause() { setBusy(true); try { await api.patch(`/capas/${id}/root-cause`, rootCause); toast.success(t('capa.root_cause_saved')); await reload(); } catch (err) { toast.error(err instanceof RequestError ? err.message : t('capa.failed')); } finally { setBusy(false); } }
  async function createAction() { setBusy(true); try { await api.post(`/capas/${id}/actions`, { title: actionForm.title, actionType: actionForm.actionType, dueDate: actionForm.dueDate || undefined }); toast.success(t('capa.action_created')); setActionDialogOpen(false); setActionForm({ title: '', actionType: 'CORRECTIVE', dueDate: '' }); await reload(); } catch (err) { toast.error(err instanceof RequestError ? err.message : t('capa.failed')); } finally { setBusy(false); } }
  async function completeAction(actionId: string) { setBusy(true); try { await api.patch(`/capas/${id}/actions/${actionId}`, { status: 'COMPLETED' }); toast.success(t('capa.action_completed')); await reload(); } catch (err) { toast.error(err instanceof RequestError ? err.message : t('capa.failed')); } finally { setBusy(false); } }
  async function doVerify() { setBusy(true); try { await api.post(`/capas/${id}/verify`, { result: verificationResult, notes: verificationNotes || undefined }); toast.success(t('capa.verification_recorded')); await reload(); } catch (err) { toast.error(err instanceof RequestError ? err.message : t('capa.failed')); } finally { setBusy(false); } }
  async function doEffectiveness() { setBusy(true); try { await api.post(`/capas/${id}/effectiveness`, { result: effectivenessResult, notes: effectivenessNotes || undefined }); toast.success(t('capa.effectiveness_recorded')); await reload(); } catch (err) { toast.error(err instanceof RequestError ? err.message : t('capa.failed')); } finally { setBusy(false); } }
  async function doClose() { setBusy(true); try { await api.post(`/capas/${id}/close`, { closureComment: closureComment || undefined }); toast.success(t('capa.closed')); await reload(); } catch (err) { toast.error(err instanceof RequestError ? err.message : t('capa.failed')); } finally { setBusy(false); } }
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) { const file = e.target.files?.[0]; if (!file || !evidenceActionId) return; try { const fd = new FormData(); fd.append('file', file); await uploadFile(`/capas/${id}/actions/${evidenceActionId}/evidence`, fd); toast.success(t('capa.evidence_uploaded')); if (fileRef.current) fileRef.current.value = ''; setEvidenceActionId(''); } catch (err) { toast.error(err instanceof RequestError ? err.message : t('capa.upload_failed')); } }
  async function downloadReport(format: 'pdf' | 'xlsx') { const token = getAccessToken(); const res = await fetch(`${API_BASE}/api/v1/capas/${id}/report.${format}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }); if (!res.ok) { toast.error(t('capa.report_failed')); return; } const blob = await res.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `capa-${id}.${format}`; a.click(); URL.revokeObjectURL(url); }

  if (loading) return <div className="mx-auto max-w-5xl p-8 text-sm text-muted-foreground">{t('capa.loading')}</div>;
  if (error || !capa) return <div className="mx-auto max-w-5xl"><ErrorState message={error ?? t('capa.not_found')} /></div>;

  const canManage = hasPermission('capas.update');
  const canVerify = hasPermission('capas.verify');
  const canEffectiveness = hasPermission('capas.effectiveness_review');
  const canClose = hasPermission('capas.close');
  const canSubmit = hasPermission('capas.submit');
  const canRework = hasPermission('capas.rework');

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <Link href="/capas" className="text-xs text-muted-foreground hover:underline">{`← ${t('capa.title')}`}</Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><Badge variant="outline" className="font-mono">{capa.referenceNumber}</Badge><Badge variant={STATUS_TONE[capa.status] ?? 'secondary'}>{statusLabel(capa.status)}</Badge>{capa.isOverdue ? <Badge variant="danger">{t('capa.overdue')}</Badge> : null}</div>
            <h2 className="mt-1 text-xl font-semibold text-foreground">{capa.title}</h2>
            <p className="text-sm text-muted-foreground">{capa.departmentName} · {capa.processName ?? '—'} · {t('capa.priority')}: {priorityLabel(capa.priority)}{capa.ownerName ? ` · ${t('common.owner')}: ${capa.ownerName}` : ''}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* TECPAP workflow — pilot actions */}
            {capa.status === 'ASSIGNED' && (canManage || canSubmit) ? <Button size="sm" onClick={() => void transition('IN_PROGRESS')} disabled={busy}>{t('capa.to_in_progress')}</Button> : null}
            {(capa.status === 'IN_PROGRESS' || capa.status === 'EVIDENCE_UPLOADED') && canSubmit ? <Button size="sm" onClick={() => void submit()} disabled={busy}><CheckCircle2 className="size-4" /> {t('capa.submit')}</Button> : null}
            {capa.status === 'RETURNED' && canRework ? <Button size="sm" onClick={() => void rework()} disabled={busy}>{t('capa.rework')}</Button> : null}
            {/* TECPAP workflow — manager actions */}
            {capa.status === 'VALIDATED' && canClose ? <Button size="sm" onClick={() => void doClose()} disabled={busy}>{t('capa.close_capa')}</Button> : null}
            {/* Legacy workflow — manager only */}
            {capa.status === 'DRAFT' && canManage ? <Button size="sm" onClick={() => void transition('ROOT_CAUSE_ANALYSIS')} disabled={busy}>{t('capa.to_root_cause')}</Button> : null}
            {capa.status === 'ROOT_CAUSE_ANALYSIS' && canManage ? <Button size="sm" onClick={() => void transition('ACTION_PLAN')} disabled={busy}>{t('capa.to_action_plan')}</Button> : null}
            {capa.status === 'ACTION_PLAN' && canManage ? <Button size="sm" onClick={() => void transition('IN_PROGRESS')} disabled={busy}>{t('capa.to_in_progress')}</Button> : null}
            {/* Reports */}
            {capa.status !== 'CLOSED' ? <Fragment><Button size="sm" variant="outline" onClick={() => void downloadReport('pdf')}><Download className="size-4" /> PDF</Button><Button size="sm" variant="outline" onClick={() => void downloadReport('xlsx')}><Download className="size-4" /> Excel</Button></Fragment> : null}
          </div>
        </div>
      </div>

      {/* Phase 7.7 — TECPAP workflow stage visualizer */}
      {capa.stage ? (
        <section className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin">
            {WORKFLOW_STAGES.map((stage, i) => {
              const isActive = capa.stage === stage;
              const isPast = WORKFLOW_STAGES.indexOf(capa.stage as typeof WORKFLOW_STAGES[number]) > i && stage !== 'RETURNED';
              return (
                <div key={stage} className="flex items-center">
                  {i > 0 ? <div className={`h-0.5 w-4 shrink-0 ${isPast ? 'bg-primary' : 'bg-border'}`} /> : null}
                  <div className={`flex shrink-0 flex-col items-center gap-1`}>
                    <div className={`flex size-6 items-center justify-center rounded-full text-[10px] font-semibold ${isActive ? 'bg-primary text-primary-foreground' : isPast ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                      {isPast ? '✓' : i + 1}
                    </div>
                    <span className={`whitespace-nowrap text-[9px] ${isActive ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{t(`capa.status.${stage}`, stage)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border border-border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold text-foreground">{t('capa.root_cause_analysis')}</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><Label>{t('capa.problem_statement')}</Label><Textarea className="mt-1" value={rootCause.problemStatement} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRootCause((c) => ({ ...c, problemStatement: e.target.value }))} disabled={!canManage} /></div>
          <div><Label>{t('capa.immediate_cause')}</Label><Textarea className="mt-1" value={rootCause.immediateCause} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRootCause((c) => ({ ...c, immediateCause: e.target.value }))} disabled={!canManage} /></div>
          <div><Label>{t('capa.root_cause')}</Label><Textarea className="mt-1" value={rootCause.rootCause} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRootCause((c) => ({ ...c, rootCause: e.target.value }))} disabled={!canManage} /></div>
          <div><Label>{t('capa.contributing_factors')}</Label><Textarea className="mt-1" value={rootCause.contributingFactors} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRootCause((c) => ({ ...c, contributingFactors: e.target.value }))} disabled={!canManage} /></div>
        </div>
        {canManage ? <Button size="sm" className="mt-3" onClick={() => void saveRootCause()} disabled={busy}>{t('capa.save_root_cause')}</Button> : null}
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-foreground">{t('capa.actions')} ({capa.actions.length})</h3>{canManage ? <Button size="sm" variant="outline" onClick={() => setActionDialogOpen(true)}><PlusCircle className="size-4" /> {t('capa.add')}</Button> : null}</div>
        {capa.actions.length === 0 ? <p className="text-sm text-muted-foreground">{t('capa.no_actions_yet')}</p> : (
          <ul className="space-y-2">
            {capa.actions.map((action) => (
              <li key={action.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-3 text-sm">
                <div>
                  <div className="flex items-center gap-2"><Badge variant="outline" className="text-[10px]">{actionTypeLabel(action.actionType)}</Badge><span className="font-medium text-foreground">{action.title}</span>{action.isOverdue ? <Badge variant="danger" className="text-[10px]">{t('capa.overdue')}</Badge> : null}</div>
                  <p className="text-xs text-muted-foreground">{action.ownerName ?? t('capa.unassigned')} · {action.status}{action.dueDate ? ` · ${t('capa.due')}: ${new Date(action.dueDate).toLocaleDateString()}` : ''}</p>
                </div>
                <div className="flex gap-1">
                  {action.status !== 'COMPLETED' && action.status !== 'VERIFIED' ? (
                    <Fragment>
                      <Button size="sm" variant="ghost" onClick={() => setEvidenceActionId(action.id)}><Upload className="size-3.5" /></Button>
                      {hasPermission('capa_actions.complete') ? <Button size="sm" variant="ghost" onClick={() => void completeAction(action.id)}><CheckCircle2 className="size-3.5" /></Button> : null}
                    </Fragment>
                  ) : <Badge variant="success" className="text-[10px]">{t('capa.done')}</Badge>}
                </div>
              </li>
            ))}
          </ul>
        )}
        <input ref={fileRef} type="file" className="hidden" onChange={(e: React.ChangeEvent<HTMLInputElement>) => void onFile(e)} />
        {evidenceActionId ? <p className="mt-2 text-xs text-muted-foreground">{t('capa.selecting_evidence')}</p> : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-5">
          <h3 className="mb-3 text-sm font-semibold text-foreground">{t('capa.verification')}</h3>
          {/* Active control: gated purely by status + permission, so it correctly
              reappears every time the CAPA cycles back through PENDING_VERIFICATION
              — the history below never blocks a repeat verification attempt. */}
          {capa.status === 'PENDING_VERIFICATION' && canVerify ? (
            <div className="space-y-2"><select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={verificationResult} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setVerificationResult(e.target.value)}><option value="PASSED">{t('capa.result_passed')}</option><option value="FAILED">{t('capa.result_failed')}</option></select><Input placeholder={t('capa.notes')} value={verificationNotes} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVerificationNotes(e.target.value)} /><Button size="sm" onClick={() => void doVerify()} disabled={busy}>{t('capa.verify')}</Button></div>
          ) : capa.verifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('capa.pending_verification')}</p>
          ) : null}

          {/* Audit trail: every attempt ever recorded, oldest first — additional
              history, not a replacement for the active control above. */}
          {capa.verifications.length > 0 ? (
            <div className={capa.status === 'PENDING_VERIFICATION' && canVerify ? 'mt-4 border-t border-border pt-3' : ''}>
              <VerificationHistoryList verifications={capa.verifications} labels={{ title: t('capa.verification_history'), attempt: t('capa.attempt'), by: t('capa.by'), resultLabel }} />
            </div>
          ) : null}
        </section>

        <section className="rounded-lg border border-border bg-card p-5">
          <h3 className="mb-3 text-sm font-semibold text-foreground">{t('capa.effectiveness')}</h3>
          {capa.effectiveness ? (
            <div className="text-sm"><Badge variant={capa.effectiveness.result === 'EFFECTIVE' ? 'success' : 'warning'}>{resultLabel(capa.effectiveness.result)}</Badge><p className="mt-1 text-muted-foreground">{t('capa.by')}: {capa.effectiveness.reviewedByName} · {new Date(capa.effectiveness.reviewedAt).toLocaleString()}</p>{capa.effectiveness.notes ? <p className="mt-1 text-muted-foreground">{capa.effectiveness.notes}</p> : null}</div>
          ) : capa.status === 'PENDING_EFFECTIVENESS' && canEffectiveness ? (
            <div className="space-y-2"><select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={effectivenessResult} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEffectivenessResult(e.target.value)}><option value="EFFECTIVE">{t('capa.result_effective')}</option><option value="PARTIALLY_EFFECTIVE">{t('capa.result_partially_effective')}</option><option value="INEFFECTIVE">{t('capa.result_ineffective')}</option></select><Input placeholder={t('capa.notes')} value={effectivenessNotes} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEffectivenessNotes(e.target.value)} /><Button size="sm" onClick={() => void doEffectiveness()} disabled={busy}>{t('capa.review')}</Button></div>
          ) : <p className="text-sm text-muted-foreground">{t('capa.pending_effectiveness')}</p>}
        </section>
      </div>

      {capa.status === 'PENDING_EFFECTIVENESS' && capa.effectiveness?.result === 'EFFECTIVE' && canClose ? (
        <section className="rounded-lg border border-border bg-card p-5">
          <h3 className="mb-3 text-sm font-semibold text-foreground">{t('capa.closure')}</h3>
          <div className="flex flex-col gap-2"><Input placeholder={t('capa.closure_comment')} value={closureComment} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setClosureComment(e.target.value)} /><Button onClick={() => void doClose()} disabled={busy}>{t('capa.close_capa')}</Button></div>
        </section>
      ) : null}

      {actionDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4" onClick={() => setActionDialogOpen(false)}>
          <div className="w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-lg font-semibold">{t('capa.new_action')}</h3>
            <div className="flex flex-col gap-3">
              <div><Label>{t('common.title')}</Label><Input className="mt-1" value={actionForm.title} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setActionForm((c) => ({ ...c, title: e.target.value }))} /></div>
              <div className="flex gap-2"><select className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm" value={actionForm.actionType} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setActionForm((c) => ({ ...c, actionType: e.target.value }))}><option value="CONTAINMENT">{t('capa.containment')}</option><option value="CORRECTIVE">{t('capa.corrective')}</option><option value="PREVENTIVE">{t('capa.preventive')}</option></select><DatePicker className="flex-1" value={actionForm.dueDate || null} minDate={new Date().toISOString().slice(0, 10)} onChange={(v) => setActionForm((c) => ({ ...c, dueDate: v ?? '' }))} placeholder="Due date" /></div>
              <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setActionDialogOpen(false)}>{t('common.cancel')}</Button><Button onClick={() => void createAction()} disabled={busy || !actionForm.title}>{busy ? <Loader2 className="size-4 animate-spin" /> : null}{t('common.create')}</Button></div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
