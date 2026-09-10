'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Bookmark, CheckCircle2, Download, GitCompare, MessageSquare, Package, Printer, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import type { DocumentCommentDto, DocumentHistoryEventDto, DocumentPreviewDto, AcknowledgementStatusDto } from '@tecpap/types';
import { Badge, Button } from '@tecpap/ui';
import { cn } from '@tecpap/ui';
import { Textarea } from '@/components/ui/textarea';
import { PreviewRouter } from '@/components/viewers/preview-router';
import { api, getAccessToken, RequestError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useTranslation } from '@/lib/i18n';
import { ErrorState } from '@/components/admin/common';

type Tab = 'preview' | 'comments' | 'history' | 'related' | 'metadata';

export default function ViewerPage() {
  const params = useParams();
  const id = params?.id as string;
  const { t } = useTranslation();
  const { hasPermission, user } = useAuth();
  const [tab, setTab] = useState<Tab>('preview');
  const [preview, setPreview] = useState<DocumentPreviewDto | null>(null);
  const [comments, setComments] = useState<DocumentCommentDto[]>([]);
  const [history, setHistory] = useState<DocumentHistoryEventDto[]>([]);
  const [related, setRelated] = useState<{ id: string; type: string; targetTitle: string | null }[]>([]);
  const [ack, setAck] = useState<AcknowledgementStatusDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, c, h, r, a] = await Promise.all([
        api.get<DocumentPreviewDto>(`/documents/${id}/preview`),
        api.get<DocumentCommentDto[]>(`/documents/${id}/comments`),
        api.get<DocumentHistoryEventDto[]>(`/documents/${id}/history`),
        api.get<{ id: string; type: string; targetTitle: string | null }[]>(`/documents/${id}/relations`).catch(() => []),
        api.get<AcknowledgementStatusDto>(`/documents/${id}/acknowledgements`).catch(() => null),
      ]);
      setPreview(p); setComments(c); setHistory(h); setRelated(r); setAck(a);
    } catch (err) { setError(err instanceof RequestError ? err.message : 'Failed to load.'); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  async function track(event: 'downloaded' | 'printed') { await api.post(`/documents/${id}/track`, { event }).catch(() => undefined); }
  async function acknowledge() { setBusy(true); try { await api.post(`/documents/${id}/acknowledge`); toast.success(t('doc.acknowledged')); await load(); } catch (e) { toast.error(e instanceof RequestError ? e.message : 'Failed.'); } finally { setBusy(false); } }
  async function bookmark() { setBusy(true); try { await api.post('/bookmarks', { type: 'document', entityId: id, label: preview?.title ?? id, href: `/documents/${id}/viewer` }); toast.success(t('doc.bookmark')); } catch { /* ignore */ } finally { setBusy(false); } }
  async function addComment() { if (!body.trim()) return; setBusy(true); try { await api.post(`/documents/${id}/comments`, { body }); setBody(''); await load(); } catch (e) { toast.error(e instanceof RequestError ? e.message : 'Failed.'); } finally { setBusy(false); } }
  async function resolveComment(cid: string, resolved: boolean) { try { await api.post(`/documents/comments/${cid}/resolve`, { resolved: !resolved }); await load(); } catch { /* ignore */ } }
  async function offlinePackage() {
    try {
      const token = getAccessToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001'}/api/v1/documents/${id}/export/package`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error('Failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `${preview?.metadata.code ?? id}-audit-package.zip`; a.click(); URL.revokeObjectURL(url);
    } catch { toast.error('Failed.'); }
  }

  if (error) return <div className="mx-auto max-w-6xl p-8"><ErrorState message={error} /></div>;
  if (!preview) return <div className="mx-auto max-w-6xl p-8 text-sm text-muted-foreground">Loading…</div>;
  const canComment = hasPermission('documents.update');
  const acked = ack ? ack.acknowledged.some((a) => a.userId === user?.id) : false;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/documents/${id}`} className="text-xs text-muted-foreground hover:underline">← {preview.metadata.code as string}</Link>
          <h1 className="truncate text-lg font-semibold text-foreground">{preview.title}</h1>
          <p className="text-xs text-muted-foreground">{preview.metadata.fileName as string} · {(preview.metadata.sizeBytes as number) ? `${Math.round((preview.metadata.sizeBytes as number) / 1024)} KB` : ''}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          <Link href={`/documents/${id}/compare`} className="inline-flex h-8 items-center gap-1 rounded-md border border-input bg-background px-3 text-sm hover:bg-accent"><GitCompare className="size-4" /> {t('doc.compare')}</Link>
          <Button size="sm" variant="outline" onClick={() => { track('downloaded'); window.open(preview.fileUrl, '_blank'); }}><Download className="size-4" /> {t('doc.download')}</Button>
          <Button size="sm" variant="outline" onClick={() => { track('printed'); window.open(preview.fileUrl, '_blank'); }}><Printer className="size-4" /> {t('doc.print')}</Button>
          <Button size="sm" variant="outline" onClick={() => void bookmark()} disabled={busy}><Bookmark className="size-4" /></Button>
          <Button size="sm" variant="outline" onClick={() => void offlinePackage()}><Package className="size-4" /></Button>
          <Button size="sm" onClick={() => void acknowledge()} disabled={busy || !!acked}>{acked ? <><CheckCircle2 className="size-4" /> {t('doc.acknowledged')}</> : t('doc.acknowledge')}</Button>
        </div>
      </div>

      <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
        {(['preview', 'comments', 'history', 'related', 'metadata'] as Tab[]).map((tb) => (
          <button key={tb} type="button" onClick={() => setTab(tb)} className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors', tab === tb ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
            {tb === 'comments' ? <MessageSquare className="size-3.5" /> : null}{t(`doc.${tb === 'preview' ? 'viewer' : tb}`)}{tb === 'comments' && comments.length ? ` (${comments.length})` : ''}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card">
        {tab === 'preview' ? <PreviewRouter preview={preview} metadata={preview.metadata} /> : null}
        {tab === 'comments' ? (
          <div className="p-4">
            {canComment ? (
              <div className="mb-4 flex flex-col gap-2">
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={t('doc.add_comment')} />
                <Button size="sm" className="self-start" onClick={() => void addComment()} disabled={busy || !body.trim()}>{t('doc.add_comment')}</Button>
              </div>
            ) : null}
            {comments.length === 0 ? <p className="text-sm text-muted-foreground">{t('doc.no_comments')}</p> : (
              <ul className="flex flex-col gap-3">
                {comments.map((c) => (
                  <li key={c.id} className={`rounded-md border p-3 ${c.resolved ? 'border-border/50 bg-muted/20 opacity-75' : 'border-border'}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">
                        {c.authorName} {c.resolved ? <Badge variant="success" className="ml-1 text-[10px]">{t('doc.resolved')}</Badge> : null}
                      </span>
                      {canComment ? (
                        c.resolved ? (
                          <Button size="sm" variant="outline" className="h-6 gap-1 px-2 text-xs" onClick={() => void resolveComment(c.id, c.resolved)} aria-label="Reopen comment">
                            <RotateCcw className="size-3" /> {t('doc.reopen', 'Reopen')}
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" className="h-6 gap-1 px-2 text-xs text-success" onClick={() => void resolveComment(c.id, c.resolved)} aria-label="Resolve comment">
                            <CheckCircle2 className="size-3" /> {t('doc.resolve')}
                          </Button>
                        )
                      ) : null}
                    </div>
                    <p className={`mt-1 whitespace-pre-wrap text-sm ${c.resolved ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{c.body}</p>
                    {c.replies.length > 0 ? (
                      <ul className="mt-2 flex flex-col gap-2 border-l-2 border-border pl-3">
                        {c.replies.map((r) => <li key={r.id}><span className="text-xs font-medium">{r.authorName}:</span> <span className="text-sm text-muted-foreground">{r.body}</span></li>)}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
        {tab === 'history' ? (
          <div className="p-4">{history.length === 0 ? <p className="text-sm text-muted-foreground">{t('doc.no_events')}</p> : (
            <ul className="flex flex-col gap-2">{history.map((e) => (
              <li key={e.id} className="flex items-center justify-between border-b border-border pb-2 text-sm last:border-0">
                <div><span className="font-medium text-foreground">{e.title}</span><span className="ml-2 text-xs text-muted-foreground">{e.actorName ?? ''}</span></div>
                <span className="text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleString()}</span>
              </li>
            ))}</ul>
          )}</div>
        ) : null}
        {tab === 'related' ? (
          <div className="p-4">{related.length === 0 ? <p className="text-sm text-muted-foreground">—</p> : (
            <ul className="flex flex-col gap-1">{related.map((r) => <li key={r.id}><Badge variant="outline" className="mr-2 text-[10px]">{r.type}</Badge>{r.targetTitle}</li>)}</ul>
          )}</div>
        ) : null}
        {tab === 'metadata' ? (
          <div className="p-4"><pre className="overflow-x-auto whitespace-pre-wrap text-xs text-muted-foreground">{JSON.stringify(preview.metadata, null, 2)}</pre>
            {ack ? (
              <div className="mt-4">
                <h3 className="mb-1 text-sm font-semibold">{t('doc.who_read')}</h3>
                <p className="text-xs text-success-fg">{ack.acknowledged.length} read</p>
                <p className="text-xs text-warning-fg">{ack.pending.length} pending</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
