'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CheckCircle2, Download, Loader2, PlusCircle, Send, Upload, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { FINDING_SEVERITIES, FINDING_SEVERITY_LABELS, type FindingSeverity } from '@tecpap/config';
import { Badge, Button, Input, Label } from '@tecpap/ui';
import type { FindingDto } from '@tecpap/types';
import { api, getAccessToken, RequestError, uploadFile } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ErrorState } from '@/components/admin/common';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';
const STATUS_TONE: Record<string, 'secondary' | 'warning' | 'success' | 'danger' | 'outline'> = { PLANNED: 'secondary', IN_PROGRESS: 'warning', SUBMITTED: 'outline', UNDER_REVIEW: 'outline', RETURNED: 'danger', APPROVED: 'success', COMPLETED: 'success' };

interface LocalAnswer { value: string; status: string }

export default function AuditExecutionPage() {
  const params = useParams();
  const id = params?.id as string;
  const { hasPermission } = useAuth();
  const [audit, setAudit] = useState<Record<string, unknown> | null>(null);
  const [answers, setAnswers] = useState<Record<string, LocalAnswer>>({});
  const [findings, setFindings] = useState<FindingDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [findingOpen, setFindingOpen] = useState(false);
  const [findingForm, setFindingForm] = useState({ title: '', severity: 'OBSERVATION' as FindingSeverity, description: '' });
  const [findingSaving, setFindingSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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
      setFindings((await api.get<FindingDto[]>(`/audits/${id}/findings`).catch(() => [])));
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

  async function lifecycle(action: string, label: string, body?: Record<string, unknown>) {
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

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append('file', file);
      await uploadFile(`/audits/${id}/evidence`, formData);
      toast.success('Evidence uploaded');
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      toast.error(err instanceof RequestError ? err.message : 'Upload failed.');
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
  const sections = (audit.sections as Array<{ id: string; title: string; questions: Array<{ id: string; text: string; type: string; required: boolean }> }>) ?? [];
  const canExecute = hasPermission('audits.execute');
  const canApprove = hasPermission('audits.approve');

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <Link href="/audits" className="text-xs text-muted-foreground hover:underline">← Audits</Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">{audit.title as string}</h2>
              <Badge variant={STATUS_TONE[status] ?? 'secondary'}>{status}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{audit.templateName as string} · {audit.departmentName as string} · Progress {audit.progress as number}% · Compliance {audit.compliance !== null ? `${audit.compliance}%` : '—'}</p>
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

      {/* Checklist */}
      <div className="flex flex-col gap-4">
        {sections.map((section) => (
          <section key={section.id} className="rounded-lg border border-border bg-card p-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground">{section.title}</h3>
            <div className="space-y-3">
              {section.questions.map((question) => {
                const answer = answers[question.id] ?? { value: '', status: 'pending' };
                const isText = ['SHORT_TEXT', 'LONG_TEXT', 'NUMBER', 'DATE'].includes(question.type);
                return (
                  <div key={question.id} className="rounded-md border border-border p-3">
                    <p className="mb-2 text-sm font-medium text-foreground">{question.text}{question.required ? <span className="ml-1 text-destructive">*</span> : null}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Select
                        value={answer.status}
                        onValueChange={(value) => { setAnswers((current) => ({ ...current, [question.id]: { ...current[question.id]!, status: value } })); void saveAnswer(question.id); }}
                      >
                        <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="ok">Conformant</SelectItem>
                          <SelectItem value="fail">Non-conformant</SelectItem>
                          <SelectItem value="na">N.A.</SelectItem>
                        </SelectContent>
                      </Select>
                      {isText ? (
                        question.type === 'LONG_TEXT' ? (
                          <Textarea className="flex-1" placeholder="Answer…" value={answer.value} disabled={!canExecute}
                            onChange={(e) => setAnswers((current) => ({ ...current, [question.id]: { ...current[question.id]!, value: e.target.value } }))}
                            onBlur={() => void saveAnswer(question.id)} />
                        ) : (
                          <Input className="flex-1" type={question.type === 'NUMBER' ? 'number' : question.type === 'DATE' ? 'date' : 'text'} placeholder="Answer…" value={answer.value} disabled={!canExecute}
                            onChange={(e) => setAnswers((current) => ({ ...current, [question.id]: { ...current[question.id]!, value: e.target.value } }))}
                            onBlur={() => void saveAnswer(question.id)} />
                        )
                      ) : null}
                    </div>
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
            <h3 className="text-sm font-semibold text-foreground">Findings</h3>
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
            <h3 className="text-sm font-semibold text-foreground">Evidence</h3>
            <input ref={fileRef} type="file" className="hidden" onChange={(e) => void onFile(e)} />
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><Upload className="size-4" /> Upload</Button>
          </div>
          <p className="text-sm text-muted-foreground">Attach photos, PDFs or files to questions, findings or the audit.</p>
        </section>
      </div>

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
    </div>
  );
}
