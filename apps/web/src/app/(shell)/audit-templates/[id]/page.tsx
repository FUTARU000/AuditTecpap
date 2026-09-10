'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CheckCircle2, Copy, FileText, Loader2, Send, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { QUESTION_TYPE_LABELS, type QuestionType } from '@tecpap/config';
import type { AuditTemplateDetailDto } from '@tecpap/types';
import { Badge, Button } from '@tecpap/ui';
import { api, RequestError } from '@/lib/api';
import { ErrorState } from '@/components/admin/common';

export default function TemplateDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [template, setTemplate] = useState<AuditTemplateDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTemplate(await api.get<AuditTemplateDetailDto>(`/audit-templates/${id}`));
    } catch (err) {
      setError(err instanceof RequestError ? err.message : 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void reload(); }, [reload]);

  async function act(action: 'publish' | 'archive' | 'clone', label: string) {
    setBusy(true);
    try {
      await api.post(`/audit-templates/${id}/${action}`, {});
      toast.success(label);
      await reload();
    } catch (err) {
      toast.error(err instanceof RequestError ? err.message : `Could not ${action}.`);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="mx-auto max-w-4xl p-8 text-sm text-muted-foreground">Loading…</div>;
  if (error || !template) return <div className="mx-auto max-w-4xl"><ErrorState message={error ?? 'Not found'} /></div>;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div>
        <Link href="/audit-templates" className="text-xs text-muted-foreground hover:underline">← Templates</Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">{template.name}</h2>
              <Badge variant={template.status === 'PUBLISHED' ? 'success' : template.status === 'ARCHIVED' ? 'secondary' : 'warning'}>{template.status}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{template.category} · v{template.version} · {template.questionCount} questions</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {template.status === 'DRAFT' ? <Button size="sm" onClick={() => void act('publish', 'Template published')} disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Publish</Button> : null}
            {template.status === 'PUBLISHED' ? <Button size="sm" variant="outline" onClick={() => void act('archive', 'Template archived')} disabled={busy}><XCircle className="size-4" /> Archive</Button> : null}
            <Button size="sm" variant="outline" onClick={() => void act('clone', 'Template cloned')} disabled={busy}><Copy className="size-4" /> Clone</Button>
          </div>
        </div>
      </div>

      {template.sections.length === 0 ? (
        <p className="text-sm text-muted-foreground">This template has no sections yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {template.sections.map((section) => (
            <section key={section.id} className="rounded-lg border border-border bg-card p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground"><FileText className="size-4 text-muted-foreground" /> {section.title}</h3>
              <ul className="space-y-2">
                {section.questions.map((question) => (
                  <li key={question.id} className="flex items-start justify-between gap-2 rounded-md border border-border p-3 text-sm">
                    <div>
                      <p className="font-medium text-foreground">{question.text}{question.required ? <span className="ml-1 text-destructive">*</span> : null}</p>
                      <p className="text-xs text-muted-foreground">{QUESTION_TYPE_LABELS[question.type as QuestionType]}{question.evidenceRequired ? ' · evidence required' : ''}{question.findingRequired ? ' · finding required' : ''}{question.weight && question.weight !== 1 ? ` · ×${question.weight}` : ''}</p>
                      {question.options && question.options.length > 0 ? (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {question.options.map((opt, oi) => (
                            <span key={oi} className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">{opt}</span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    {question.required ? <CheckCircle2 className="size-4 text-muted-foreground" /> : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
