'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  CheckCircle2, Download, Eye, File, FileText, Image as ImageIcon, Loader2, PlusCircle,
  Send, Trash2, Upload, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { FINDING_SEVERITIES, FINDING_SEVERITY_LABELS, type FindingSeverity } from '@tecpap/config';
import { Badge, Button, Input, Label } from '@tecpap/ui';
import type { AuditEvidenceDto, FindingDto } from '@tecpap/types';
import { api, getAccessToken, RequestError, uploadFile } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ErrorState } from '@/components/admin/common';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';
const STATUS_TONE: Record<string, 'secondary' | 'warning' | 'success' | 'danger' | 'outline'> = { PLANNED: 'secondary', IN_PROGRESS: 'warning', SUBMITTED: 'outline', UNDER_REVIEW: 'outline', RETURNED: 'danger', APPROVED: 'success', COMPLETED: 'success' };

interface LocalAnswer { value: string; status: string }

interface QuestionDef {
  id: string;
  text: string;
  type: string;
  required: boolean;
  evidenceRequired?: boolean;
  findingRequired?: boolean;
  weight?: number;
  helpText?: string;
  options?: string[];
}

function fileIcon(mime: string) {
  if (mime.startsWith('image/')) return ImageIcon;
  if (mime === 'application/pdf') return FileText;
  return File;
}
function isImage(mime: string) { return mime.startsWith('image/'); }
function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export default function AuditExecutionPage() {
  const params = useParams();
  const id = params?.id as string;
  const { hasPermission } = useAuth();
  const [audit, setAudit] = useState<Record<string, unknown> | null>(null);
  const [answers, setAnswers] = useState<Record<string, LocalAnswer>>({});
  const [findings, setFindings] = useState<FindingDto[]>([]);
  const [evidence, setEvidence] = useState<AuditEvidenceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [findingOpen, setFindingOpen] = useState(false);
  const [findingForm, setFindingForm] = useState({ title: '', severity: 'OBSERVATION' as FindingSeverity, description: '' });
  const [findingSaving, setFindingSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const questionFileRef = useRef<HTMLInputElement>(null);
  const [attachQuestionId, setAttachQuestionId] = useState<string | null>(null);
  const [previewEvidence, setPreviewEvidence] = useState<AuditEvidenceDto | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const detail = (await api.get(`/audits/${id}`)) as Record<string, unknown>;
      setAudit(detail);
      const sections = (detail.sections as Array<{ questions: Array<{ id: string; answer?: { value: unknown; status: string } | null }> }>) ?? [];
      const map: Record<string, LocalAnswer> = {};
      for (const section of sections) {
        for (const question of section.questions) {
          const value = question.answer ? String((question.answer.value as { text?: string } | string | null) ?? '') : '';
          map[question.id] = { value, status: question.answer?.status ?? 'pending' };
        }
      }
      setAnswers(map);
      const [f, e] = await Promise.all([
        api.get<FindingDto[]>(`/audits/${id}/findings`).catch(() => []),
        api.get<AuditEvidenceDto[]>(`/audits/${id}/evidence`).catch(() => []),
      ]);
      setFindings(f);
      setEvidence(e);
    } catch (err) {
      setError(err instanceof RequestError ? err.message : 'Failed to load audit.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void reload(); }, [reload]);

  async function saveAnswer(questionId: string) {
    const answer = answers[questionId];
    if (!answer) return;
    try {
      await api.patch(`/audits/${id}/answer`, { questionId, value: { text: answer.value }, status: answer.status });
    } catch (err) {
      toast.error(err instanceof RequestError ? err.message : 'Could not save answer.');
    }
  }

  function updateAnswer(qid: string, value: string, status?: string) {
    setAnswers((cur) => ({ ...cur, [qid]: { value, status: status ?? cur[qid]?.status ?? 'pending' } }));
  }

  async function lifecycle(action: string, label: string, body?: Record<string, unknown>) {
    if (action === 'submit') {
      const missing = allQuestions.filter((q) => q.required && (answers[q.id]?.status ?? 'pending') === 'pending');
      if (missing.length > 0) {
        toast.error(`${missing.length} required question(s) unanswered. Please answer before submitting.`);
        return;
      }
      // Evidence-required enforcement: question must have at least one evidence attached
      const needEvidence = allQuestions.filter((q) => q.evidenceRequired && !evidence.some((e) => e.questionId === q.id));
      const firstEvidenceQ = needEvidence[0];
      if (firstEvidenceQ) {
        toast.error(`Evidence is required for this question: "${firstEvidenceQ.text}"`);
        return;
      }
    }
    setBusy(true);
    try {
      await api.post(`/audits/${id}/${action}`, body ?? {});
      toast.success(label);
      await reload();
    } catch (err) {
      toast.error(err instanceof RequestError ? err.message : `Could not ${action}.`);
    } finally {
      setBusy(false);
    }
  }

  async function createFinding() {
    setFindingSaving(true);
    try {
      await api.post(`/audits/${id}/findings`, { auditId: id, title: findingForm.title, severity: findingForm.severity, description: findingForm.description || null });
      toast.success('Finding created');
      setFindingOpen(false);
      setFindingForm({ title: '', severity: 'OBSERVATION', description: '' });
      setFindings(await api.get<FindingDto[]>(`/audits/${id}/findings`));
    } catch (err) {
      toast.error(err instanceof RequestError ? err.message : 'Could not create finding.');
    } finally {
      setFindingSaving(false);
    }
  }

  async function onFile(event: React.ChangeEvent<HTMLInputElement>, questionId?: string) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (questionId) formData.append('questionId', questionId);
      await uploadFile(`/audits/${id}/evidence`, formData);
      toast.success('Evidence uploaded');
      if (event.target) event.target.value = '';
      setAttachQuestionId(null);
      setEvidence(await api.get<AuditEvidenceDto[]>(`/audits/${id}/evidence`).catch(() => []));
    } catch (err) {
      toast.error(err instanceof RequestError ? err.message : 'Upload failed.');
    }
  }

  function attachEvidence(questionId: string) {
    setAttachQuestionId(questionId);
    questionFileRef.current?.click();
  }

  async function downloadEvidence(ev: AuditEvidenceDto) {
    try {
      const token = getAccessToken();
      const res = await fetch(`${API_BASE}/api/v1/audits/${id}/evidence/${ev.id}/download`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = ev.fileName; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Download failed.'); }
  }

  async function openPreview(ev: AuditEvidenceDto) {
    setPreviewEvidence(ev);
    setPreviewUrl(null);
    try {
      const token = getAccessToken();
      const res = await fetch(`${API_BASE}/api/v1/audits/${id}/evidence/${ev.id}/download`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      setPreviewUrl(URL.createObjectURL(blob));
    } catch { toast.error('Preview failed.'); }
  }

  async function deleteEvidence(ev: AuditEvidenceDto) {
    try {
      await api.delete(`/audits/${id}/evidence/${ev.id}`);
      toast.success('Evidence deleted');
      setEvidence(await api.get<AuditEvidenceDto[]>(`/audits/${id}/evidence`).catch(() => []));
    } catch (err) {
      toast.error(err instanceof RequestError ? err.message : 'Delete failed.');
    }
  }

  async function downloadReport(format: 'pdf' | 'xlsx') {
    const token = getAccessToken();
    const res = await fetch(`${API_BASE}/api/v1/audits/${id}/report.${format}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) { toast.error('Report generation failed.'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `audit-${id}.${format}`; a.click(); URL.revokeObjectURL(url);
  }

  if (loading) return <div className="mx-auto max-w-4xl p-8 text-sm text-muted-foreground">Loading audit…</div>;
  if (error || !audit) return <div className="mx-auto max-w-4xl"><ErrorState message={error ?? 'Not found'} /></div>;

  const status = audit.status as string;
  const sections = (audit.sections as Array<{ id: string; title: string; questions: QuestionDef[] }>) ?? [];
  const canExecute = hasPermission('audits.execute');
  const canApprove = hasPermission('audits.approve');

  const allQuestions = sections.flatMap((s) => s.questions);
  const answeredCount = allQuestions.filter((q) => (answers[q.id]?.status ?? 'pending') !== 'pending').length;
  const totalCount = allQuestions.length;
  const progressPct = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      {/* Header */}
      <div>
        <Link href="/audits" className="text-xs text-muted-foreground hover:underline">← Audits</Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">{audit.title as string}</h2>
              <Badge variant={STATUS_TONE[status] ?? 'secondary'}>{status}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{audit.templateName as string} · {audit.departmentName as string}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(status === 'PLANNED' || status === 'RETURNED') && canExecute ? <Button size="sm" onClick={() => void lifecycle('start', 'Audit started')} disabled={busy}><Send className="size-4" /> Start</Button> : null}
            {(status === 'IN_PROGRESS' || status === 'RETURNED') && canExecute ? <Button size="sm" onClick={() => void lifecycle('submit', 'Submitted for review')} disabled={busy}><CheckCircle2 className="size-4" /> Submit</Button> : null}
            {(status === 'SUBMITTED' || status === 'UNDER_REVIEW') && canApprove ? <Button size="sm" onClick={() => void lifecycle('approve', 'Audit approved')} disabled={busy}><CheckCircle2 className="size-4" /> Approve</Button> : null}
            {(status === 'SUBMITTED' || status === 'UNDER_REVIEW') && canApprove ? <Button size="sm" variant="outline" onClick={() => void lifecycle('return', 'Returned for corrections')} disabled={busy}><XCircle className="size-4" /> Return</Button> : null}
            {status === 'APPROVED' && canApprove ? <Button size="sm" onClick={() => void lifecycle('complete', 'Audit completed')} disabled={busy}><CheckCircle2 className="size-4" /> Complete</Button> : null}
            <Button size="sm" variant="outline" onClick={() => void downloadReport('pdf')}><Download className="size-4" /> PDF</Button>
            <Button size="sm" variant="outline" onClick={() => void downloadReport('xlsx')}><Download className="size-4" /> Excel</Button>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{answeredCount} / {totalCount} answered</span>
          <span className="flex gap-3">
            <span>📄 {evidence.length} evidence</span>
            <span>⚠ {findings.length} findings</span>
            <span>{progressPct}%</span>
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Checklist with question type rendering */}
      <div className="flex flex-col gap-4">
        {sections.map((section, si) => (
          <section key={section.id} className="rounded-lg border border-border bg-card p-5">
            <h3 className="mb-1 text-sm font-semibold text-foreground">{si + 1}. {section.title}</h3>
            <div className="space-y-3">
              {section.questions.map((question, qi) => {
                const answer = answers[question.id] ?? { value: '', status: 'pending' };
                const questionEvidence = evidence.filter((e) => e.questionId === question.id);
                const evidenceMissing = question.evidenceRequired && questionEvidence.length === 0;
                return (
                  <div key={question.id} className={`rounded-md border p-3 ${answer.status !== 'pending' ? 'border-primary/30 bg-primary/5' : 'border-border'} ${evidenceMissing ? 'border-warning/50' : ''}`}>
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">
                        <span className="mr-1 text-xs text-muted-foreground">{si + 1}.{qi + 1}</span>
                        {question.text}
                        {question.required ? <span className="ml-1 text-destructive">*</span> : null}
                        {question.evidenceRequired ? <Badge variant="outline" className="ml-1.5 shrink-0 text-[9px] text-warning">📎</Badge> : null}
                      </p>
                      <div className="flex shrink-0 items-center gap-1">
                        {question.weight && question.weight !== 1 ? <Badge variant="outline" className="text-[10px]">×{question.weight}</Badge> : null}
                        {canExecute ? (
                          <Button size="sm" variant="ghost" className="h-6 gap-1 px-1.5 text-[10px]" onClick={() => attachEvidence(question.id)} aria-label="Attach evidence to this question">
                            <Upload className="size-3" /> {questionEvidence.length > 0 ? questionEvidence.length : ''}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    {question.helpText ? <p className="mb-2 text-xs text-muted-foreground">{question.helpText}</p> : null}
                    {evidenceMissing ? <p className="mb-2 text-xs font-medium text-warning">Evidence is required for this question.</p> : null}
                    <QuestionInput
                      question={question}
                      answer={answer}
                      disabled={!canExecute}
                      onChange={(value, status) => updateAnswer(question.id, value, status)}
                      onSave={() => void saveAnswer(question.id)}
                    />
                    {questionEvidence.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5 border-t border-border pt-2">
                        {questionEvidence.map((ev) => {
                          const Icon = fileIcon(ev.mimeType);
                          return (
                            <button key={ev.id} type="button" onClick={() => void openPreview(ev)} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent" title={ev.fileName}>
                              <Icon className="size-3" /> {ev.fileName.slice(0, 20)}{ev.fileName.length > 20 ? '…' : ''}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Findings */}
        <section className="rounded-lg border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Findings ({findings.length})</h3>
            <Button size="sm" variant="outline" onClick={() => setFindingOpen(true)}><PlusCircle className="size-4" /> Add</Button>
          </div>
          {findings.length === 0 ? <p className="text-sm text-muted-foreground">No findings.</p> : (
            <ul className="space-y-2">
              {findings.map((finding) => (
                <li key={finding.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-foreground">{finding.title}</span>
                  <Badge variant={finding.severity === 'MAJOR_NC' || finding.severity === 'MINOR_NC' ? 'danger' : 'warning'}>{FINDING_SEVERITY_LABELS[finding.severity]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Evidence */}
        <section className="rounded-lg border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Evidence ({evidence.length})</h3>
            <input ref={fileRef} type="file" className="hidden" onChange={(e) => void onFile(e)} />
            <input ref={questionFileRef} type="file" className="hidden" onChange={(e) => void onFile(e, attachQuestionId ?? undefined)} />
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><Upload className="size-4" /> Upload</Button>
          </div>
          {evidence.length === 0 ? (
            <p className="text-sm text-muted-foreground">Attach photos, PDFs or files to questions, findings or the audit.</p>
          ) : (
            <ul className="space-y-2">
              {evidence.map((ev) => {
                const Icon = fileIcon(ev.mimeType);
                return (
                  <li key={ev.id} className="flex items-center gap-2 rounded-md border border-border p-2 text-sm">
                    {isImage(ev.mimeType) && previewUrl === null ? (
                      <button type="button" onClick={() => void openPreview(ev)} className="size-10 shrink-0 overflow-hidden rounded border border-border">
                        <ThumbPreview auditId={id} evidence={ev} />
                      </button>
                    ) : (
                      <span className="flex size-10 shrink-0 items-center justify-center rounded border border-border bg-muted/40">
                        <Icon className="size-4 text-muted-foreground" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{ev.fileName}</p>
                      <p className="text-xs text-muted-foreground">{fmtSize(ev.sizeBytes)} · {ev.uploadedByName ?? '—'} · {new Date(ev.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button size="sm" variant="ghost" className="size-7 p-0" onClick={() => void openPreview(ev)} aria-label="Preview"><Eye className="size-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="size-7 p-0" onClick={() => void downloadEvidence(ev)} aria-label="Download"><Download className="size-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="size-7 p-0 text-destructive" onClick={() => void deleteEvidence(ev)} aria-label="Delete"><Trash2 className="size-3.5" /></Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Finding dialog */}
      <Dialog open={findingOpen} onOpenChange={setFindingOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New finding</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2"><Label htmlFor="f-title">Title</Label><Input id="f-title" value={findingForm.title} onChange={(e) => setFindingForm((c) => ({ ...c, title: e.target.value }))} /></div>
            <div className="flex flex-col gap-2">
              <Label>Severity</Label>
              <Select value={findingForm.severity} onValueChange={(v) => setFindingForm((c) => ({ ...c, severity: v as FindingSeverity }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{FINDING_SEVERITIES.map((s) => <SelectItem key={s} value={s}>{FINDING_SEVERITY_LABELS[s]}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="flex flex-col gap-2"><Label htmlFor="f-desc">Description</Label><Textarea id="f-desc" value={findingForm.description} onChange={(e) => setFindingForm((c) => ({ ...c, description: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFindingOpen(false)}>Cancel</Button>
            <Button onClick={() => void createFinding()} disabled={findingSaving || !findingForm.title}>{findingSaving ? <Loader2 className="size-4 animate-spin" /> : null}Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Evidence preview modal */}
      <Dialog open={!!previewEvidence} onOpenChange={(o) => { if (!o) { setPreviewEvidence(null); setPreviewUrl(null); } }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>{previewEvidence?.fileName}</DialogTitle></DialogHeader>
          {previewUrl ? (
            isImage(previewEvidence?.mimeType ?? '') ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt={previewEvidence?.fileName ?? ''} className="max-h-[70vh] w-full object-contain" />
            ) : previewEvidence?.mimeType === 'application/pdf' ? (
              <iframe src={previewUrl} className="h-[70vh] w-full rounded-md border-0" />
            ) : (
              <div className="flex flex-col items-center gap-3 p-8 text-center">
                <File className="size-16 text-muted-foreground/40" strokeWidth={1} />
                <p className="text-sm text-muted-foreground">Preview not available for this format. Use Download.</p>
              </div>
            )
          ) : (
            <div className="flex h-40 items-center justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
          )}
          <DialogFooter>
            {previewEvidence ? <Button variant="outline" onClick={() => void downloadEvidence(previewEvidence)}><Download className="size-4" /> Download</Button> : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Thumbnail for image evidence */
function ThumbPreview({ auditId, evidence }: { auditId: string; evidence: AuditEvidenceDto }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    const token = getAccessToken();
    fetch(`${API_BASE}/api/v1/audits/${auditId}/evidence/${evidence.id}/download`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => { if (active && b) { objectUrl = URL.createObjectURL(b); setUrl(objectUrl); } })
      .catch(() => undefined);
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [auditId, evidence.id]);
  if (!url) return <div className="size-full animate-pulse bg-muted" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="size-full object-cover" />;
}

/** Question-type-aware input renderer */
function QuestionInput({
  question, answer, disabled, onChange, onSave,
}: {
  question: QuestionDef;
  answer: LocalAnswer;
  disabled: boolean;
  onChange: (value: string, status?: string) => void;
  onSave: () => void;
}) {
  const opts = question.options ?? [];

  const handleNumber = (v: string) => {
    if (v !== '' && !/^-?\d*\.?\d*$/.test(v)) return;
    onChange(v);
  };

  switch (question.type) {
    case 'LONG_TEXT':
      return (
        <div className="space-y-2">
          <Textarea className="min-h-20" placeholder="Answer…" value={answer.value} disabled={disabled}
            onChange={(e) => onChange(e.target.value)} onBlur={onSave} />
          <StatusSelect answer={answer} disabled={disabled} onChange={onChange} onSave={onSave} />
        </div>
      );

    case 'NUMBER':
      return (
        <div className="flex flex-wrap items-center gap-2">
          <Input className="w-32" type="number" placeholder="0" value={answer.value} disabled={disabled}
            onChange={(e) => handleNumber(e.target.value)} onBlur={onSave} />
          <StatusSelect answer={answer} disabled={disabled} onChange={onChange} onSave={onSave} />
        </div>
      );

    case 'DATE':
      return (
        <div className="flex flex-wrap items-center gap-2">
          <Input className="w-44" type="date" value={answer.value} disabled={disabled}
            onChange={(e) => onChange(e.target.value)} onBlur={onSave} />
          <StatusSelect answer={answer} disabled={disabled} onChange={onChange} onSave={onSave} />
        </div>
      );

    case 'DROPDOWN':
      return (
        <div className="flex flex-wrap items-center gap-2">
          <Select value={answer.value || '__none__'} onValueChange={(v) => { onChange(v === '__none__' ? '' : v, 'ok'); onSave(); }} disabled={disabled}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">—</SelectItem>
              {opts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
          <StatusSelect answer={answer} disabled={disabled} onChange={onChange} onSave={onSave} />
        </div>
      );

    case 'MULTIPLE_CHOICE':
      return (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {opts.map((o) => {
              const selected = answer.value === o;
              return (
                <button key={o} type="button" disabled={disabled}
                  onClick={() => { onChange(selected ? '' : o, selected ? 'pending' : 'ok'); onSave(); }}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:bg-accent'}`}>
                  {o}
                </button>
              );
            })}
          </div>
          <StatusSelect answer={answer} disabled={disabled} onChange={onChange} onSave={onSave} />
        </div>
      );

    case 'CHECKBOX':
      return (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-3">
            {(opts.length > 0 ? opts : ['Checked']).map((o) => {
              const checkedList = answer.value ? answer.value.split(',') : [];
              const isChecked = checkedList.includes(o);
              return (
                <label key={o} className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-foreground">
                  <input type="checkbox" checked={isChecked} disabled={disabled}
                    onChange={() => {
                      const next = isChecked ? checkedList.filter((v) => v !== o) : [...checkedList, o];
                      onChange(next.join(','), next.length > 0 ? 'ok' : 'pending'); onSave();
                    }}
                    className="size-4 rounded border-border" />
                  {o}
                </label>
              );
            })}
          </div>
          <StatusSelect answer={answer} disabled={disabled} onChange={onChange} onSave={onSave} />
        </div>
      );

    case 'YES_NO':
    case 'YES_NO_NA':
      return (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-2">
            <BigToggle label="Yes" active={answer.status === 'ok'} color="success" disabled={disabled}
              onClick={() => { onChange(answer.value, 'ok'); onSave(); }} />
            <BigToggle label="No" active={answer.status === 'fail'} color="danger" disabled={disabled}
              onClick={() => { onChange(answer.value, 'fail'); onSave(); }} />
            {question.type === 'YES_NO_NA' ? (
              <BigToggle label="N/A" active={answer.status === 'na'} color="neutral" disabled={disabled}
                onClick={() => { onChange(answer.value, 'na'); onSave(); }} />
            ) : null}
          </div>
        </div>
      );

    default:
      return (
        <div className="flex flex-wrap items-center gap-2">
          <Input className="flex-1 min-w-40" placeholder="Answer…" value={answer.value} disabled={disabled}
            onChange={(e) => onChange(e.target.value)} onBlur={onSave} />
          <StatusSelect answer={answer} disabled={disabled} onChange={onChange} onSave={onSave} />
        </div>
      );
  }
}

function StatusSelect({ answer, disabled, onChange, onSave }: { answer: LocalAnswer; disabled: boolean; onChange: (v: string, s?: string) => void; onSave: () => void }) {
  return (
    <Select value={answer.status} onValueChange={(value) => { onChange(answer.value, value); onSave(); }} disabled={disabled}>
      <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="pending">Pending</SelectItem>
        <SelectItem value="ok">Conformant</SelectItem>
        <SelectItem value="fail">Non-conformant</SelectItem>
        <SelectItem value="na">N.A.</SelectItem>
      </SelectContent>
    </Select>
  );
}

function BigToggle({ label, active, color, disabled, onClick }: { label: string; active: boolean; color: 'success' | 'danger' | 'neutral'; disabled: boolean; onClick: () => void }) {
  const activeClass = color === 'success' ? 'border-green-600 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' :
    color === 'danger' ? 'border-red-600 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300' :
    'border-border bg-muted text-muted-foreground';
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      className={`rounded-md border px-4 py-1.5 text-sm font-medium transition-colors disabled:opacity-40 ${active ? activeClass : 'border-border text-muted-foreground hover:bg-accent'}`}>
      {label}
    </button>
  );
}
