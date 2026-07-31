'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, PlusCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { QUESTION_TYPES, QUESTION_TYPE_LABELS, TEMPLATE_CATEGORIES, type QuestionType } from '@tecpap/config';
import type { AuditTemplateDto, DepartmentDto, PaginatedResult } from '@tecpap/types';
import { Badge, Button, Input, Label } from '@tecpap/ui';
import { Checkbox } from '@/components/ui/checkbox';
import { api, RequestError } from '@/lib/api';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState, ErrorState, PageHeader } from '@/components/admin/common';
import { useTranslation } from '@/lib/i18n';

interface QuestionForm { text: string; type: QuestionType; required: boolean }
interface SectionForm { title: string; questions: QuestionForm[] }

const emptyQuestion = (): QuestionForm => ({ text: '', type: 'YES_NO', required: false });
const emptySection = (): SectionForm => ({ title: '', questions: [emptyQuestion()] });

export default function AuditTemplatesPage() {
  const [templates, setTemplates] = useState<AuditTemplateDto[]>([]);
  const { t } = useTranslation();
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string>(TEMPLATE_CATEGORIES[0] as string);
  const [departmentId, setDepartmentId] = useState('');
  const [processId, setProcessId] = useState('');
  const [sections, setSections] = useState<SectionForm[]>([emptySection()]);
  const [saving, setSaving] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<PaginatedResult<AuditTemplateDto>>('/audit-templates', { pageSize: 100 });
      setTemplates(result.items);
    } catch (err) {
      setError(err instanceof RequestError ? err.message : 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetch();
    api.get<PaginatedResult<DepartmentDto>>('/departments', { pageSize: 100 }).then((r) => setDepartments(r.items)).catch(() => undefined);
  }, [fetch]);

  function openCreate() {
    setName(''); setCategory(TEMPLATE_CATEGORIES[0] as string); setDepartmentId(''); setProcessId(''); setSections([emptySection()]);
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    try {
      await api.post('/audit-templates', {
        name, category, departmentId: departmentId || undefined, processId: processId || undefined,
        sections: sections.filter((s) => s.title.trim()).map((section, si) => ({
          title: section.title, order: si,
          questions: section.questions.filter((q) => q.text.trim()).map((q, qi) => ({ ...q, order: qi })),
        })),
      });
      toast.success('Template created');
      setOpen(false);
      await fetch();
    } catch (err) {
      toast.error(err instanceof RequestError ? err.message : 'Could not create template.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <PageHeader title={t('audit.templates_title', 'Audit templates')} description={t('audit.templates_desc')} action={<Button onClick={openCreate}><PlusCircle className="size-4" /> New template</Button>} />

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {error ? <ErrorState message={error} onRetry={() => void fetch()} /> : loading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-md bg-muted" />)}</div>
        ) : templates.length === 0 ? <EmptyState title={t('empty.no_templates', 'No templates')} description="Create your first audit checklist." /> : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Questions</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Version</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {templates.map((template) => (
                <tr key={template.id} className="hover:bg-accent/40">
                  <td className="px-4 py-3"><Link href={`/audit-templates/${template.id}`} className="font-medium text-foreground hover:underline">{template.name}</Link></td>
                  <td className="px-4 py-3 text-muted-foreground">{template.category}</td>
                  <td className="px-4 py-3 text-muted-foreground">{template.questionCount}</td>
                  <td className="px-4 py-3 text-muted-foreground">v{template.version}</td>
                  <td className="px-4 py-3"><Badge variant={template.status === 'PUBLISHED' ? 'success' : template.status === 'ARCHIVED' ? 'secondary' : 'warning'}>{template.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>New audit template</DialogTitle></DialogHeader>
          <div className="flex max-h-[65vh] flex-col gap-4 overflow-y-auto pr-1">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2 sm:col-span-2"><Label htmlFor="t-name">Name</Label><Input id="t-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div className="flex flex-col gap-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TEMPLATE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Department (optional)</Label>
                <Select value={departmentId || '__none__'} onValueChange={(v) => setDepartmentId(v === '__none__' ? '' : v)}><SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger><SelectContent><SelectItem value="__none__">Any</SelectItem>{departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select>
              </div>
            </div>

            {sections.map((section, sectionIndex) => (
              <div key={sectionIndex} className="rounded-md border border-border p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Input className="flex-1" placeholder="Section title" value={section.title} onChange={(e) => setSections((current) => current.map((s, i) => i === sectionIndex ? { ...s, title: e.target.value } : s))} />
                  <Button size="icon" variant="ghost" onClick={() => setSections((current) => current.filter((_, i) => i !== sectionIndex))} aria-label="Remove section"><Trash2 className="size-4" /></Button>
                </div>
                {section.questions.map((question, questionIndex) => (
                  <div key={questionIndex} className="mb-2 flex items-center gap-2 pl-3">
                    <Input className="flex-1" placeholder="Question text" value={question.text} onChange={(e) => setSections((current) => current.map((s, si) => si === sectionIndex ? { ...s, questions: s.questions.map((q, qi) => qi === questionIndex ? { ...q, text: e.target.value } : q) } : s))} />
                    <Select value={question.type} onValueChange={(v) => setSections((current) => current.map((s, si) => si === sectionIndex ? { ...s, questions: s.questions.map((q, qi) => qi === questionIndex ? { ...q, type: v as QuestionType } : q) } : s))}>
                      <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>{QUESTION_TYPES.map((t) => <SelectItem key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</SelectItem>)}</SelectContent>
                    </Select>
                    <label className="flex items-center gap-1 text-xs"><Checkbox checked={question.required} onCheckedChange={(v) => setSections((current) => current.map((s, si) => si === sectionIndex ? { ...s, questions: s.questions.map((q, qi) => qi === questionIndex ? { ...q, required: v === true } : q) } : s))} /> Req</label>
                    <Button size="icon" variant="ghost" onClick={() => setSections((current) => current.map((s, si) => si === sectionIndex ? { ...s, questions: s.questions.filter((_, qi) => qi !== questionIndex) } : s))} aria-label="Remove question"><Trash2 className="size-4" /></Button>
                  </div>
                ))}
                <Button size="sm" variant="outline" onClick={() => setSections((current) => current.map((s, si) => si === sectionIndex ? { ...s, questions: [...s.questions, emptyQuestion()] } : s))}><PlusCircle className="size-4" /> Add question</Button>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => setSections((current) => [...current, emptySection()])}><PlusCircle className="size-4" /> Add section</Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => void save()} disabled={saving || !name}>{saving ? <Loader2 className="size-4 animate-spin" /> : null}Create template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
