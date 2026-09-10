'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDown, ArrowUp, ChevronDown, ChevronUp, Copy, GripVertical, Loader2,
  PlusCircle, Trash2, X,
} from 'lucide-react';
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

/** Types that support a dynamic option list */
const OPTION_TYPES: QuestionType[] = ['CHECKBOX', 'MULTIPLE_CHOICE', 'DROPDOWN'];

interface QuestionForm {
  text: string;
  type: QuestionType;
  required: boolean;
  evidenceRequired: boolean;
  findingRequired: boolean;
  weight: number;
  options: string[];
}
interface SectionForm { title: string; collapsed: boolean; questions: QuestionForm[] }

const emptyQuestion = (): QuestionForm => ({ text: '', type: 'YES_NO', required: false, evidenceRequired: false, findingRequired: false, weight: 1, options: [] });
const emptySection = (): SectionForm => ({ title: '', collapsed: false, questions: [emptyQuestion()] });

/** Types that keep options when switching */
const compatibleType = (from: QuestionType, to: QuestionType): boolean => OPTION_TYPES.includes(from) && OPTION_TYPES.includes(to);

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
  const [sections, setSections] = useState<SectionForm[]>([emptySection()]);
  const [saving, setSaving] = useState(false);
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);

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
    setName(''); setCategory(TEMPLATE_CATEGORIES[0] as string); setDepartmentId(''); setSections([emptySection()]); setExpandedQuestion(null);
    setOpen(true);
  }

  // Section helpers
  function updateSection(si: number, fn: (s: SectionForm) => SectionForm) { setSections((cur) => cur.map((s, i) => i === si ? fn(s) : s)); }
  function removeSection(si: number) { setSections((cur) => cur.filter((_, i) => i !== si)); }
  function duplicateSection(si: number) { setSections((cur) => [...cur.slice(0, si + 1), { ...cur[si]!, title: `${cur[si]!.title} (copy)`, questions: cur[si]!.questions.map((q) => ({ ...q, options: [...q.options] })) }, ...cur.slice(si + 1)]); }
  function moveSection(si: number, dir: -1 | 1) { setSections((cur) => { const j = si + dir; if (j < 0 || j >= cur.length) return cur; const next = [...cur]; [next[si], next[j]] = [next[j]!, next[si]!]; return next; }); }

  // Question helpers
  function updateQuestion(si: number, qi: number, fn: (q: QuestionForm) => QuestionForm) { updateSection(si, (s) => ({ ...s, questions: s.questions.map((q, i) => i === qi ? fn(q) : q) })); }
  function removeQuestion(si: number, qi: number) { updateSection(si, (s) => ({ ...s, questions: s.questions.filter((_, i) => i !== qi) })); }
  function duplicateQuestion(si: number, qi: number) { updateSection(si, (s) => ({ ...s, questions: [...s.questions.slice(0, qi + 1), { ...s.questions[qi]!, options: [...s.questions[qi]!.options] }, ...s.questions.slice(qi + 1)] })); }
  function moveQuestion(si: number, qi: number, dir: -1 | 1) { updateSection(si, (s) => { const j = qi + dir; if (j < 0 || j >= s.questions.length) return s; const qs = [...s.questions]; [qs[qi], qs[j]] = [qs[j]!, qs[qi]!]; return { ...s, questions: qs }; }); }
  function changeType(si: number, qi: number, newType: QuestionType) {
    updateQuestion(si, qi, (q) => ({
      ...q,
      type: newType,
      // Keep options if new type is also an option-type; otherwise clear
      options: compatibleType(q.type, newType) ? q.options : [],
    }));
  }

  // Option helpers
  function addOption(si: number, qi: number) { updateQuestion(si, qi, (q) => ({ ...q, options: [...q.options, ''] })); }
  function updateOption(si: number, qi: number, oi: number, value: string) { updateQuestion(si, qi, (q) => ({ ...q, options: q.options.map((o, i) => i === oi ? value : o) })); }
  function removeOption(si: number, qi: number, oi: number) { updateQuestion(si, qi, (q) => ({ ...q, options: q.options.filter((_, i) => i !== oi) })); }
  function moveOption(si: number, qi: number, oi: number, dir: -1 | 1) { updateQuestion(si, qi, (q) => { const j = oi + dir; if (j < 0 || j >= q.options.length) return q; const opts = [...q.options]; [opts[oi], opts[j]] = [opts[j]!, opts[oi]!]; return { ...q, options: opts }; }); }

  async function save() {
    const validSections = sections.filter((s) => s.title.trim());
    const totalQuestions = validSections.reduce((n, s) => n + s.questions.filter((q) => q.text.trim()).length, 0);
    if (totalQuestions === 0) { toast.error('Add at least one question.'); return; }
    // Validate option types have at least 2 options
    for (const s of validSections) {
      for (const q of s.questions) {
        if (!q.text.trim()) continue;
        if (OPTION_TYPES.includes(q.type)) {
          const validOpts = q.options.filter((o) => o.trim());
          if (validOpts.length < 2) { toast.error(`"${q.text}" needs at least 2 options.`); return; }
        }
      }
    }

    setSaving(true);
    try {
      await api.post('/audit-templates', {
        name, category, departmentId: departmentId || undefined,
        sections: validSections.map((section, si) => ({
          title: section.title, order: si,
          questions: section.questions.filter((q) => q.text.trim()).map((q, qi) => ({
            text: q.text, type: q.type, required: q.required, order: qi,
            evidenceRequired: q.evidenceRequired || undefined,
            findingRequired: q.findingRequired || undefined,
            weight: q.weight !== 1 ? q.weight : undefined,
            options: OPTION_TYPES.includes(q.type) ? q.options.filter((o) => o.trim()) : undefined,
          })),
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

  const qKey = (si: number, qi: number) => `${si}-${qi}`;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <PageHeader title={t('audit.templates_title', 'Audit templates')} description={t('audit.templates_desc')} action={<Button onClick={openCreate}><PlusCircle className="size-4" /> New template</Button>} />

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {error ? <ErrorState message={error} onRetry={() => void fetch()} /> : loading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-md bg-muted" />)}</div>
        ) : templates.length === 0 ? <EmptyState title={t('empty.no_templates', 'No templates')} description="Create your first audit checklist." /> : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50"><tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Category</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Questions</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Version</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</th>
            </tr></thead>
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
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>New audit template</DialogTitle></DialogHeader>
          <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
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

            {sections.map((section, si) => (
              <div key={si} className="rounded-md border border-border">
                {/* Section header */}
                <div className="flex items-center gap-1 border-b border-border p-2">
                  <Button size="icon" variant="ghost" className="size-6" onClick={() => updateSection(si, (s) => ({ ...s, collapsed: !s.collapsed }))} aria-label="Collapse section">
                    {section.collapsed ? <ChevronDown className="size-3" /> : <ChevronUp className="size-3" />}
                  </Button>
                  <Input className="flex-1 border-0 bg-transparent focus-visible:ring-0" placeholder="Section title" value={section.title} onChange={(e) => updateSection(si, (s) => ({ ...s, title: e.target.value }))} />
                  <span className="shrink-0 text-xs text-muted-foreground">{section.questions.length} q</span>
                  <Button size="icon" variant="ghost" className="size-6" onClick={() => duplicateSection(si)} aria-label="Duplicate section"><Copy className="size-3" /></Button>
                  <Button size="icon" variant="ghost" className="size-6" onClick={() => moveSection(si, -1)} disabled={si === 0} aria-label="Move section up"><ArrowUp className="size-3" /></Button>
                  <Button size="icon" variant="ghost" className="size-6" onClick={() => moveSection(si, 1)} disabled={si === sections.length - 1} aria-label="Move section down"><ArrowDown className="size-3" /></Button>
                  <Button size="icon" variant="ghost" className="size-6 text-destructive" onClick={() => removeSection(si)} aria-label="Remove section"><Trash2 className="size-3" /></Button>
                </div>

                {/* Questions */}
                {!section.collapsed && (
                  <div className="flex flex-col gap-2 p-2">
                {section.questions.map((question, qi) => {
                  const isExpanded = expandedQuestion === qKey(si, qi);
                  const hasOptions = OPTION_TYPES.includes(question.type);
                  return (
                    <div key={qi} className={`rounded-md border p-2 ${isExpanded ? 'border-primary/40 bg-primary/5' : 'border-border'}`}>
                      <div className="flex items-center gap-1.5">
                        <GripVertical className="size-3 shrink-0 text-muted-foreground/40" />
                        <Input className="min-w-0 flex-1 border-0 bg-transparent focus-visible:ring-0" placeholder={`Question ${qi + 1}`} value={question.text}
                          onChange={(e) => updateQuestion(si, qi, (q) => ({ ...q, text: e.target.value }))}
                          onFocus={() => setExpandedQuestion(qKey(si, qi))} />
                        {hasOptions ? <Badge variant="outline" className="shrink-0 text-[10px]">{question.options.filter((o) => o.trim()).length} opts</Badge> : null}
                        <Button size="icon" variant="ghost" className="size-6" onClick={() => setExpandedQuestion(isExpanded ? null : qKey(si, qi))} aria-label="Configure question">
                          {isExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                        </Button>
                      </div>

                      {/* Expanded question configuration */}
                      {isExpanded ? (
                        <div className="mt-2 flex flex-col gap-3 border-t border-border pt-2 pl-4">
                          <div className="flex flex-wrap gap-2">
                            <div className="flex flex-col gap-1">
                              <Label className="text-xs text-muted-foreground">Type</Label>
                              <Select value={question.type} onValueChange={(v) => changeType(si, qi, v as QuestionType)}>
                                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                                <SelectContent>{QUESTION_TYPES.map((t) => <SelectItem key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                            <div className="flex flex-col gap-1">
                              <Label className="text-xs text-muted-foreground">Weight</Label>
                              <Input type="number" min={1} className="w-16" value={question.weight}
                                onChange={(e) => updateQuestion(si, qi, (q) => ({ ...q, weight: Math.max(1, Number(e.target.value) || 1) }))} />
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-3 text-xs">
                            <label className="flex items-center gap-1.5"><Checkbox checked={question.required} onCheckedChange={(v) => updateQuestion(si, qi, (q) => ({ ...q, required: v === true }))} /> Required</label>
                            <label className="flex items-center gap-1.5"><Checkbox checked={question.evidenceRequired} onCheckedChange={(v) => updateQuestion(si, qi, (q) => ({ ...q, evidenceRequired: v === true }))} /> Evidence required</label>
                            <label className="flex items-center gap-1.5"><Checkbox checked={question.findingRequired} onCheckedChange={(v) => updateQuestion(si, qi, (q) => ({ ...q, findingRequired: v === true }))} /> Finding required</label>
                          </div>

                          {/* Dynamic option builder for CHECKBOX / DROPDOWN / MULTIPLE_CHOICE */}
                          {hasOptions ? (
                            <div className="flex flex-col gap-1.5">
                              <Label className="text-xs font-medium text-muted-foreground">Options</Label>
                              {question.options.length === 0 ? (
                                <p className="text-xs text-muted-foreground">No options yet. Add at least 2.</p>
                              ) : question.options.map((opt, oi) => (
                                <div key={oi} className="flex items-center gap-1">
                                  <GripVertical className="size-3 shrink-0 text-muted-foreground/30" />
                                  <span className="w-4 shrink-0 text-center text-xs text-muted-foreground">{oi + 1}</span>
                                  <Input className="h-7 flex-1 text-xs" placeholder={`Option ${oi + 1}`} value={opt}
                                    onChange={(e) => updateOption(si, qi, oi, e.target.value)} />
                                  <Button size="icon" variant="ghost" className="size-5" onClick={() => moveOption(si, qi, oi, -1)} disabled={oi === 0} aria-label="Move option up"><ArrowUp className="size-2.5" /></Button>
                                  <Button size="icon" variant="ghost" className="size-5" onClick={() => moveOption(si, qi, oi, 1)} disabled={oi === question.options.length - 1} aria-label="Move option down"><ArrowDown className="size-2.5" /></Button>
                                  <Button size="icon" variant="ghost" className="size-5 text-destructive" onClick={() => removeOption(si, qi, oi)} aria-label="Remove option"><X className="size-3" /></Button>
                                </div>
                              ))}
                              <Button size="sm" variant="outline" className="self-start" onClick={() => addOption(si, qi)}><PlusCircle className="size-3" /> Add option</Button>
                            </div>
                          ) : null}

                          {/* Question actions */}
                          <div className="flex gap-1 border-t border-border pt-2">
                            <Button size="sm" variant="ghost" onClick={() => duplicateQuestion(si, qi)}><Copy className="size-3" /> Duplicate</Button>
                            <Button size="sm" variant="ghost" onClick={() => moveQuestion(si, qi, -1)} disabled={qi === 0}><ArrowUp className="size-3" /> Up</Button>
                            <Button size="sm" variant="ghost" onClick={() => moveQuestion(si, qi, 1)} disabled={qi === section.questions.length - 1}><ArrowDown className="size-3" /> Down</Button>
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeQuestion(si, qi)}><Trash2 className="size-3" /> Delete</Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                <Button size="sm" variant="outline" onClick={() => updateSection(si, (s) => ({ ...s, questions: [...s.questions, emptyQuestion()] }))}><PlusCircle className="size-4" /> Add question</Button>
                  </div>
                )}
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => setSections((cur) => [...cur, emptySection()])}><PlusCircle className="size-4" /> Add section</Button>
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
