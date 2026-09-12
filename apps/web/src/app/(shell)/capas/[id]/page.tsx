'use client';

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  CheckCircle2,
  Download,
  Eye,
  File,
  FileText,
  Image as ImageIcon,
  Loader2,
  PlusCircle,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import type { CapaActionEvidenceDto, CapaDetailDto } from '@tecpap/types';
import { Badge, Button, Input, Label } from '@tecpap/ui';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { api, getAccessToken, RequestError, uploadFile } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useTranslation } from '@/lib/i18n';
import { ErrorState } from '@/components/admin/common';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { VerificationHistoryList } from '@/components/capa/verification-history-list';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

function fileIcon(mime: string) {
  if (mime.startsWith('image/')) return ImageIcon;
  if (mime === 'application/pdf') return FileText;
  return File;
}
function isImage(mime: string) {
  return mime.startsWith('image/');
}
function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}
const STATUS_TONE: Record<string, 'secondary' | 'warning' | 'success' | 'danger' | 'outline'> = {
  DRAFT: 'secondary',
  ROOT_CAUSE_ANALYSIS: 'secondary',
  ACTION_PLAN: 'secondary',
  IN_PROGRESS: 'warning',
  PENDING_VERIFICATION: 'outline',
  PENDING_EFFECTIVENESS: 'outline',
  CLOSED: 'success',
  CANCELLED: 'danger',
  ASSIGNED: 'secondary',
  EVIDENCE_UPLOADED: 'outline',
  RETURNED: 'danger',
  VALIDATED: 'success',
};

const WORKFLOW_STAGES = [
  'ASSIGNED',
  'IN_PROGRESS',
  'EVIDENCE_UPLOADED',
  'AWAITING_VERIFICATION',
  'RETURNED',
  'VALIDATED',
  'CLOSED',
] as const;

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
  const [actionForm, setActionForm] = useState({
    title: '',
    actionType: 'CORRECTIVE',
    dueDate: '',
  });
  const [rootCause, setRootCause] = useState({
    problemStatement: '',
    immediateCause: '',
    rootCause: '',
    contributingFactors: '',
  });
  const [verificationResult, setVerificationResult] = useState('PASSED');
  const [verificationNotes, setVerificationNotes] = useState('');
  const [effectivenessResult, setEffectivenessResult] = useState('EFFECTIVE');
  const [effectivenessNotes, setEffectivenessNotes] = useState('');
  const [closureComment, setClosureComment] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [evidenceActionId, setEvidenceActionId] = useState('');
  const [actionNotes, setActionNotes] = useState<Record<string, string>>({});
  const [actionEvidence, setActionEvidence] = useState<Record<string, CapaActionEvidenceDto[]>>({});
  const [previewEvidence, setPreviewEvidence] = useState<{
    actionId: string;
    evidence: CapaActionEvidenceDto;
  } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const statusLabel = (s: string) => t(`status.${s}`, s);
  const priorityLabel = (p: string) => t(`priority.${p}`, p);
  const actionTypeLabel = (a: string) =>
    a === 'CONTAINMENT'
      ? t('capa.containment')
      : a === 'CORRECTIVE'
        ? t('capa.corrective')
        : a === 'PREVENTIVE'
          ? t('capa.preventive')
          : a;
  const resultLabel = (r: string) =>
    r === 'PASSED'
      ? t('capa.result_passed')
      : r === 'FAILED'
        ? t('capa.result_failed')
        : r === 'EFFECTIVE'
          ? t('capa.result_effective')
          : r === 'PARTIALLY_EFFECTIVE'
            ? t('capa.result_partially_effective')
            : r === 'INEFFECTIVE'
              ? t('capa.result_ineffective')
              : r;

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const detail = await api.get<CapaDetailDto>(`/capas/${id}`);
      setCapa(detail);
      if (detail.rootCause) {
        setRootCause({
          problemStatement: detail.rootCause.problemStatement ?? '',
          immediateCause: detail.rootCause.immediateCause ?? '',
          rootCause: detail.rootCause.rootCause ?? '',
          contributingFactors: detail.rootCause.contributingFactors ?? '',
        });
      }
      const entries = await Promise.all(
        detail.actions.map(
          async (a) =>
            [
              a.id,
              await api
                .get<CapaActionEvidenceDto[]>(`/capas/${id}/actions/${a.id}/evidence`)
                .catch(() => []),
            ] as const,
        ),
      );
      setActionEvidence(Object.fromEntries(entries));
    } catch (err) {
      setError(err instanceof RequestError ? err.message : t('capa.failed_load'));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function fetchEvidenceUrl(actionId: string, evidenceId: string): Promise<string> {
    const { url } = await api.get<{ url: string }>(
      `/capas/${id}/actions/${actionId}/evidence/${evidenceId}/download`,
    );
    return url;
  }

  async function downloadEvidence(actionId: string, ev: CapaActionEvidenceDto) {
    try {
      const signedUrl = await fetchEvidenceUrl(actionId, ev.id);
      const res = await fetch(signedUrl);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = ev.fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t('capa.evidence_download_failed'));
    }
  }

  async function openEvidencePreview(actionId: string, ev: CapaActionEvidenceDto) {
    setPreviewEvidence({ actionId, evidence: ev });
    setPreviewUrl(null);
    try {
      const signedUrl = await fetchEvidenceUrl(actionId, ev.id);
      const res = await fetch(signedUrl);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      setPreviewUrl(URL.createObjectURL(blob));
    } catch {
      toast.error(t('capa.evidence_preview_failed'));
    }
  }

  async function transition(target: string) {
    setBusy(true);
    try {
      await api.post(`/capas/${id}/transition`, { status: target });
      toast.success(t('capa.status_updated'));
      await reload();
    } catch (err) {
      toast.error(err instanceof RequestError ? err.message : t('capa.failed'));
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    setBusy(true);
    try {
      await api.post(`/capas/${id}/submit`);
      toast.success(t('capa.submit'));
      await reload();
    } catch (err) {
      toast.error(err instanceof RequestError ? err.message : t('capa.failed'));
    } finally {
      setBusy(false);
    }
  }
  async function rework() {
    setBusy(true);
    try {
      await api.post(`/capas/${id}/rework`);
      toast.success(t('capa.rework'));
      await reload();
    } catch (err) {
      toast.error(err instanceof RequestError ? err.message : t('capa.failed'));
    } finally {
      setBusy(false);
    }
  }
  async function saveRootCause() {
    setBusy(true);
    try {
      await api.patch(`/capas/${id}/root-cause`, rootCause);
      toast.success(t('capa.root_cause_saved'));
      await reload();
    } catch (err) {
      toast.error(err instanceof RequestError ? err.message : t('capa.failed'));
    } finally {
      setBusy(false);
    }
  }
  async function createAction() {
    setBusy(true);
    try {
      await api.post(`/capas/${id}/actions`, {
        title: actionForm.title,
        actionType: actionForm.actionType,
        dueDate: actionForm.dueDate || undefined,
      });
      toast.success(t('capa.action_created'));
      setActionDialogOpen(false);
      setActionForm({ title: '', actionType: 'CORRECTIVE', dueDate: '' });
      await reload();
    } catch (err) {
      toast.error(err instanceof RequestError ? err.message : t('capa.failed'));
    } finally {
      setBusy(false);
    }
  }
  async function completeAction(actionId: string) {
    setBusy(true);
    try {
      await api.patch(`/capas/${id}/actions/${actionId}`, { status: 'COMPLETED' });
      toast.success(t('capa.action_completed'));
      await reload();
    } catch (err) {
      toast.error(err instanceof RequestError ? err.message : t('capa.failed'));
    } finally {
      setBusy(false);
    }
  }
  async function doVerify() {
    setBusy(true);
    try {
      await api.post(`/capas/${id}/verify`, {
        result: verificationResult,
        notes: verificationNotes || undefined,
      });
      toast.success(t('capa.verification_recorded'));
      await reload();
    } catch (err) {
      toast.error(err instanceof RequestError ? err.message : t('capa.failed'));
    } finally {
      setBusy(false);
    }
  }
  async function verifyAction(actionId: string, result: 'PASSED' | 'FAILED') {
    setBusy(true);
    try {
      await api.post(`/capas/${id}/actions/${actionId}/verify`, {
        result,
        notes: actionNotes[actionId] || undefined,
      });
      toast.success(t('capa.action_verification_recorded'));
      setActionNotes((n) => ({ ...n, [actionId]: '' }));
      await reload();
    } catch (err) {
      toast.error(err instanceof RequestError ? err.message : t('capa.failed'));
    } finally {
      setBusy(false);
    }
  }
  async function doEffectiveness() {
    setBusy(true);
    try {
      await api.post(`/capas/${id}/effectiveness`, {
        result: effectivenessResult,
        notes: effectivenessNotes || undefined,
      });
      toast.success(t('capa.effectiveness_recorded'));
      await reload();
    } catch (err) {
      toast.error(err instanceof RequestError ? err.message : t('capa.failed'));
    } finally {
      setBusy(false);
    }
  }
  async function doClose() {
    setBusy(true);
    try {
      await api.post(`/capas/${id}/close`, { closureComment: closureComment || undefined });
      toast.success(t('capa.closed'));
      await reload();
    } catch (err) {
      toast.error(err instanceof RequestError ? err.message : t('capa.failed'));
    } finally {
      setBusy(false);
    }
  }
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !evidenceActionId) return;
    try {
      const fd = new FormData();
      fd.append('file', file);
      await uploadFile(`/capas/${id}/actions/${evidenceActionId}/evidence`, fd);
      toast.success(t('capa.evidence_uploaded'));
      if (fileRef.current) fileRef.current.value = '';
      setEvidenceActionId('');
      await reload();
    } catch (err) {
      toast.error(err instanceof RequestError ? err.message : t('capa.upload_failed'));
    }
  }
  async function downloadReport(format: 'pdf' | 'xlsx') {
    const token = getAccessToken();
    const res = await fetch(`${API_BASE}/api/v1/capas/${id}/report.${format}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      toast.error(t('capa.report_failed'));
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `capa-${id}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading)
    return (
      <div className="text-muted-foreground mx-auto max-w-5xl p-8 text-sm">{t('capa.loading')}</div>
    );
  if (error || !capa)
    return (
      <div className="mx-auto max-w-5xl">
        <ErrorState message={error ?? t('capa.not_found')} />
      </div>
    );

  const canManage = hasPermission('capas.update');
  const canVerify = hasPermission('capas.verify');
  const canEffectiveness = hasPermission('capas.effectiveness_review');
  const canClose = hasPermission('capas.close');
  const canSubmit = hasPermission('capas.submit');
  const canRework = hasPermission('capas.rework');

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <Link
          href="/capas"
          className="text-muted-foreground text-xs hover:underline"
        >{`← ${t('capa.title')}`}</Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono">
                {capa.referenceNumber}
              </Badge>
              <Badge variant={STATUS_TONE[capa.status] ?? 'secondary'}>
                {statusLabel(capa.status)}
              </Badge>
              {capa.isOverdue ? <Badge variant="danger">{t('capa.overdue')}</Badge> : null}
            </div>
            <h2 className="text-foreground mt-1 text-xl font-semibold">{capa.title}</h2>
            <p className="text-muted-foreground text-sm">
              {capa.departmentName} · {capa.processName ?? '—'} · {t('capa.priority')}:{' '}
              {priorityLabel(capa.priority)}
              {capa.ownerName ? ` · ${t('common.owner')}: ${capa.ownerName}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* TECPAP workflow — pilot actions */}
            {capa.status === 'ASSIGNED' && (canManage || canSubmit) ? (
              <Button size="sm" onClick={() => void transition('IN_PROGRESS')} disabled={busy}>
                {t('capa.to_in_progress')}
              </Button>
            ) : null}
            {(capa.status === 'IN_PROGRESS' || capa.status === 'EVIDENCE_UPLOADED') && canSubmit ? (
              <Button size="sm" onClick={() => void submit()} disabled={busy}>
                <CheckCircle2 className="size-4" /> {t('capa.submit')}
              </Button>
            ) : null}
            {capa.status === 'RETURNED' && canRework ? (
              <Button size="sm" onClick={() => void rework()} disabled={busy}>
                {t('capa.rework')}
              </Button>
            ) : null}
            {/* TECPAP workflow — manager actions */}
            {capa.status === 'VALIDATED' && canClose ? (
              <Button size="sm" onClick={() => void doClose()} disabled={busy}>
                {t('capa.close_capa')}
              </Button>
            ) : null}
            {/* Legacy workflow — manager only */}
            {capa.status === 'DRAFT' && canManage ? (
              <Button
                size="sm"
                onClick={() => void transition('ROOT_CAUSE_ANALYSIS')}
                disabled={busy}
              >
                {t('capa.to_root_cause')}
              </Button>
            ) : null}
            {capa.status === 'ROOT_CAUSE_ANALYSIS' && canManage ? (
              <Button size="sm" onClick={() => void transition('ACTION_PLAN')} disabled={busy}>
                {t('capa.to_action_plan')}
              </Button>
            ) : null}
            {capa.status === 'ACTION_PLAN' && canManage ? (
              <Button size="sm" onClick={() => void transition('IN_PROGRESS')} disabled={busy}>
                {t('capa.to_in_progress')}
              </Button>
            ) : null}
            {/* Reports */}
            {capa.status !== 'CLOSED' ? (
              <Fragment>
                <Button size="sm" variant="outline" onClick={() => void downloadReport('pdf')}>
                  <Download className="size-4" /> PDF
                </Button>
                <Button size="sm" variant="outline" onClick={() => void downloadReport('xlsx')}>
                  <Download className="size-4" /> Excel
                </Button>
              </Fragment>
            ) : null}
          </div>
        </div>
      </div>

      {/* Phase 7.7 — TECPAP workflow stage visualizer */}
      {capa.stage ? (
        <section className="border-border bg-card rounded-lg border p-4">
          <div className="scrollbar-thin flex items-center gap-1 overflow-x-auto">
            {WORKFLOW_STAGES.map((stage, i) => {
              const isActive = capa.stage === stage;
              const isPast =
                WORKFLOW_STAGES.indexOf(capa.stage as (typeof WORKFLOW_STAGES)[number]) > i &&
                stage !== 'RETURNED';
              return (
                <div key={stage} className="flex items-center">
                  {i > 0 ? (
                    <div className={`h-0.5 w-4 shrink-0 ${isPast ? 'bg-primary' : 'bg-border'}`} />
                  ) : null}
                  <div className={`flex shrink-0 flex-col items-center gap-1`}>
                    <div
                      className={`flex size-6 items-center justify-center rounded-full text-[10px] font-semibold ${isActive ? 'bg-primary text-primary-foreground' : isPast ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}
                    >
                      {isPast ? '✓' : i + 1}
                    </div>
                    <span
                      className={`whitespace-nowrap text-[9px] ${isActive ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}
                    >
                      {t(`capa.status.${stage}`, stage)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="border-border bg-card rounded-lg border p-5">
        <h3 className="text-foreground mb-3 text-sm font-semibold">
          {t('capa.root_cause_analysis')}
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label>{t('capa.problem_statement')}</Label>
            <Textarea
              className="mt-1"
              value={rootCause.problemStatement}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setRootCause((c) => ({ ...c, problemStatement: e.target.value }))
              }
              disabled={!canManage}
            />
          </div>
          <div>
            <Label>{t('capa.immediate_cause')}</Label>
            <Textarea
              className="mt-1"
              value={rootCause.immediateCause}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setRootCause((c) => ({ ...c, immediateCause: e.target.value }))
              }
              disabled={!canManage}
            />
          </div>
          <div>
            <Label>{t('capa.root_cause')}</Label>
            <Textarea
              className="mt-1"
              value={rootCause.rootCause}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setRootCause((c) => ({ ...c, rootCause: e.target.value }))
              }
              disabled={!canManage}
            />
          </div>
          <div>
            <Label>{t('capa.contributing_factors')}</Label>
            <Textarea
              className="mt-1"
              value={rootCause.contributingFactors}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setRootCause((c) => ({ ...c, contributingFactors: e.target.value }))
              }
              disabled={!canManage}
            />
          </div>
        </div>
        {canManage ? (
          <Button size="sm" className="mt-3" onClick={() => void saveRootCause()} disabled={busy}>
            {t('capa.save_root_cause')}
          </Button>
        ) : null}
      </section>

      <section className="border-border bg-card rounded-lg border p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-foreground text-sm font-semibold">
            {t('capa.actions')} ({capa.actions.length})
          </h3>
          {canManage ? (
            <Button size="sm" variant="outline" onClick={() => setActionDialogOpen(true)}>
              <PlusCircle className="size-4" /> {t('capa.add')}
            </Button>
          ) : null}
        </div>
        {capa.actions.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t('capa.no_actions_yet')}</p>
        ) : (
          <ul className="space-y-2">
            {capa.actions.map((action) => {
              const latestVerification = action.verifications[action.verifications.length - 1];
              const canVerifyThisAction = capa.status === 'PENDING_VERIFICATION' && canVerify;
              return (
                <li key={action.id} className="border-border rounded-md border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {actionTypeLabel(action.actionType)}
                        </Badge>
                        <span className="text-foreground font-medium">{action.title}</span>
                        {action.isOverdue ? (
                          <Badge variant="danger" className="text-[10px]">
                            {t('capa.overdue')}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {action.ownerName ?? t('capa.unassigned')} · {action.status}
                        {action.dueDate
                          ? ` · ${t('capa.due')}: ${new Date(action.dueDate).toLocaleDateString()}`
                          : ''}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {action.status !== 'COMPLETED' && action.status !== 'VERIFIED' ? (
                        <Fragment>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEvidenceActionId(action.id)}
                          >
                            <Upload className="size-3.5" />
                          </Button>
                          {hasPermission('capa_actions.complete') ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => void completeAction(action.id)}
                            >
                              <CheckCircle2 className="size-3.5" />
                            </Button>
                          ) : null}
                        </Fragment>
                      ) : (
                        <Badge variant="success" className="text-[10px]">
                          {t('capa.done')}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Individual action verification — visible to everyone (Pilot
                      needs to see exactly which action needs rework and why),
                      but only the Manager gets the Pass/Fail control below. */}
                  <div className="border-border mt-2 flex items-center gap-2 border-t pt-2">
                    <span className="text-muted-foreground text-xs font-medium">
                      {t('capa.action_verification')}:
                    </span>
                    <Badge
                      variant={
                        action.verificationStatus === 'PASSED'
                          ? 'success'
                          : action.verificationStatus === 'FAILED'
                            ? 'danger'
                            : 'secondary'
                      }
                      className="text-[10px]"
                    >
                      {action.verificationStatus === 'PASSED'
                        ? t('capa.result_passed')
                        : action.verificationStatus === 'FAILED'
                          ? t('capa.rework_required')
                          : t('capa.not_verified')}
                    </Badge>
                  </div>
                  {action.verificationStatus === 'FAILED' && latestVerification?.notes ? (
                    <p className="text-destructive mt-1 text-xs">
                      {t('capa.reason')}: {latestVerification.notes}
                    </p>
                  ) : null}

                  {canVerifyThisAction ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Input
                        className="h-8 max-w-xs text-xs"
                        placeholder={t('capa.reason_placeholder')}
                        value={actionNotes[action.id] ?? ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setActionNotes((n) => ({ ...n, [action.id]: e.target.value }))
                        }
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void verifyAction(action.id, 'PASSED')}
                        disabled={busy}
                      >
                        {t('capa.action_pass')}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => void verifyAction(action.id, 'FAILED')}
                        disabled={busy}
                      >
                        {t('capa.action_fail')}
                      </Button>
                    </div>
                  ) : null}

                  {action.verifications.length > 0 ? (
                    <div className="border-border mt-2 border-t pt-2">
                      <VerificationHistoryList
                        verifications={action.verifications}
                        labels={{
                          title: t('capa.action_verification_history'),
                          attempt: t('capa.attempt'),
                          by: t('capa.by'),
                          resultLabel,
                        }}
                      />
                    </div>
                  ) : null}

                  {(actionEvidence[action.id]?.length ?? 0) > 0 ? (
                    <div className="border-border mt-2 border-t pt-2">
                      <h4 className="text-muted-foreground mb-1.5 text-xs font-semibold uppercase tracking-wide">
                        {t('capa.evidence')}
                      </h4>
                      <ul className="space-y-1.5">
                        {actionEvidence[action.id]!.map((ev) => {
                          const Icon = fileIcon(ev.mimeType);
                          return (
                            <li
                              key={ev.id}
                              className="border-border flex items-center gap-2 rounded-md border p-2 text-xs"
                            >
                              <span className="border-border bg-muted/40 flex size-8 shrink-0 items-center justify-center rounded border">
                                <Icon className="text-muted-foreground size-3.5" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-foreground truncate font-medium">
                                  {ev.fileName}
                                </p>
                                <p className="text-muted-foreground">
                                  {fmtSize(ev.sizeBytes)} · {ev.uploadedByName ?? '—'} ·{' '}
                                  {new Date(ev.createdAt).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="flex shrink-0 gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="size-7 p-0"
                                  onClick={() => void openEvidencePreview(action.id, ev)}
                                  aria-label={t('capa.evidence_view')}
                                >
                                  <Eye className="size-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="size-7 p-0"
                                  onClick={() => void downloadEvidence(action.id, ev)}
                                  aria-label="Download"
                                >
                                  <Download className="size-3.5" />
                                </Button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => void onFile(e)}
        />
        {evidenceActionId ? (
          <p className="text-muted-foreground mt-2 text-xs">{t('capa.selecting_evidence')}</p>
        ) : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="border-border bg-card rounded-lg border p-5">
          <h3 className="text-foreground mb-3 text-sm font-semibold">{t('capa.verification')}</h3>
          {/* Active control: gated purely by status + permission, so it correctly
              reappears every time the CAPA cycles back through PENDING_VERIFICATION
              — the history below never blocks a repeat verification attempt. */}
          {capa.status === 'PENDING_VERIFICATION' && canVerify ? (
            <div className="space-y-2">
              <select
                className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                value={verificationResult}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setVerificationResult(e.target.value)
                }
              >
                <option value="PASSED">{t('capa.result_passed')}</option>
                <option value="FAILED">{t('capa.result_failed')}</option>
              </select>
              <Input
                placeholder={t('capa.notes')}
                value={verificationNotes}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setVerificationNotes(e.target.value)
                }
              />
              <Button size="sm" onClick={() => void doVerify()} disabled={busy}>
                {t('capa.verify')}
              </Button>
            </div>
          ) : capa.verifications.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t('capa.pending_verification')}</p>
          ) : null}

          {/* Audit trail: every attempt ever recorded, oldest first — additional
              history, not a replacement for the active control above. */}
          {capa.verifications.length > 0 ? (
            <div
              className={
                capa.status === 'PENDING_VERIFICATION' && canVerify
                  ? 'border-border mt-4 border-t pt-3'
                  : ''
              }
            >
              <VerificationHistoryList
                verifications={capa.verifications}
                labels={{
                  title: t('capa.verification_history'),
                  attempt: t('capa.attempt'),
                  by: t('capa.by'),
                  resultLabel,
                }}
              />
            </div>
          ) : null}
        </section>

        <section className="border-border bg-card rounded-lg border p-5">
          <h3 className="text-foreground mb-3 text-sm font-semibold">{t('capa.effectiveness')}</h3>
          {capa.effectiveness ? (
            <div className="text-sm">
              <Badge variant={capa.effectiveness.result === 'EFFECTIVE' ? 'success' : 'warning'}>
                {resultLabel(capa.effectiveness.result)}
              </Badge>
              <p className="text-muted-foreground mt-1">
                {t('capa.by')}: {capa.effectiveness.reviewedByName} ·{' '}
                {new Date(capa.effectiveness.reviewedAt).toLocaleString()}
              </p>
              {capa.effectiveness.notes ? (
                <p className="text-muted-foreground mt-1">{capa.effectiveness.notes}</p>
              ) : null}
            </div>
          ) : capa.status === 'PENDING_EFFECTIVENESS' && canEffectiveness ? (
            <div className="space-y-2">
              <select
                className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                value={effectivenessResult}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setEffectivenessResult(e.target.value)
                }
              >
                <option value="EFFECTIVE">{t('capa.result_effective')}</option>
                <option value="PARTIALLY_EFFECTIVE">{t('capa.result_partially_effective')}</option>
                <option value="INEFFECTIVE">{t('capa.result_ineffective')}</option>
              </select>
              <Input
                placeholder={t('capa.notes')}
                value={effectivenessNotes}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setEffectivenessNotes(e.target.value)
                }
              />
              <Button size="sm" onClick={() => void doEffectiveness()} disabled={busy}>
                {t('capa.review')}
              </Button>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">{t('capa.pending_effectiveness')}</p>
          )}
        </section>
      </div>

      {capa.status === 'PENDING_EFFECTIVENESS' &&
      capa.effectiveness?.result === 'EFFECTIVE' &&
      canClose ? (
        <section className="border-border bg-card rounded-lg border p-5">
          <h3 className="text-foreground mb-3 text-sm font-semibold">{t('capa.closure')}</h3>
          <div className="flex flex-col gap-2">
            <Input
              placeholder={t('capa.closure_comment')}
              value={closureComment}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setClosureComment(e.target.value)
              }
            />
            <Button onClick={() => void doClose()} disabled={busy}>
              {t('capa.close_capa')}
            </Button>
          </div>
        </section>
      ) : null}

      {actionDialogOpen ? (
        <div
          className="bg-foreground/40 fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setActionDialogOpen(false)}
        >
          <div
            className="border-border bg-background w-full max-w-md rounded-lg border p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-lg font-semibold">{t('capa.new_action')}</h3>
            <div className="flex flex-col gap-3">
              <div>
                <Label>{t('common.title')}</Label>
                <Input
                  className="mt-1"
                  value={actionForm.title}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setActionForm((c) => ({ ...c, title: e.target.value }))
                  }
                />
              </div>
              <div className="flex gap-2">
                <select
                  className="border-input bg-background flex-1 rounded-md border px-3 py-2 text-sm"
                  value={actionForm.actionType}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setActionForm((c) => ({ ...c, actionType: e.target.value }))
                  }
                >
                  <option value="CONTAINMENT">{t('capa.containment')}</option>
                  <option value="CORRECTIVE">{t('capa.corrective')}</option>
                  <option value="PREVENTIVE">{t('capa.preventive')}</option>
                </select>
                <DatePicker
                  className="flex-1"
                  value={actionForm.dueDate || null}
                  minDate={new Date().toISOString().slice(0, 10)}
                  onChange={(v) => setActionForm((c) => ({ ...c, dueDate: v ?? '' }))}
                  placeholder="Due date"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setActionDialogOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button onClick={() => void createAction()} disabled={busy || !actionForm.title}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                  {t('common.create')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Evidence preview modal — images render inline; other formats fall back to Download. */}
      <Dialog
        open={!!previewEvidence}
        onOpenChange={(o) => {
          if (!o) {
            setPreviewEvidence(null);
            setPreviewUrl(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{previewEvidence?.evidence.fileName}</DialogTitle>
          </DialogHeader>
          {previewUrl ? (
            isImage(previewEvidence?.evidence.mimeType ?? '') ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt={previewEvidence?.evidence.fileName ?? ''}
                className="max-h-[70vh] w-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center gap-3 p-8 text-center">
                <File className="text-muted-foreground/40 size-16" strokeWidth={1} />
                <p className="text-muted-foreground text-sm">
                  {t('capa.evidence_preview_unavailable')}
                </p>
              </div>
            )
          ) : (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="text-muted-foreground size-6 animate-spin" />
            </div>
          )}
          <DialogFooter>
            {previewEvidence ? (
              <Button
                variant="outline"
                onClick={() =>
                  void downloadEvidence(previewEvidence.actionId, previewEvidence.evidence)
                }
              >
                <Download className="size-4" /> {t('common.download', 'Download')}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
