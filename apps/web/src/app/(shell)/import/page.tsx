'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { CheckCircle2, FileUp, Loader2, PlusCircle, RefreshCw, Sparkles, Upload } from 'lucide-react';
import { toast } from 'sonner';
import type { ImportDashboardStatsDto, ImportJobDto, PaginatedResult } from '@tecpap/types';
import { Badge, Button, Input, Label } from '@tecpap/ui';
import { api, RequestError, uploadFile } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useTranslation } from '@/lib/i18n';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState, ErrorState, PageHeader } from '@/components/admin/common';

const JOB_TONE: Record<string, 'secondary' | 'warning' | 'success' | 'danger' | 'outline'> = {
  PENDING: 'secondary', SCANNING: 'warning', PARSING: 'warning', CLASSIFYING: 'warning',
  WAITING_REVIEW: 'outline', IMPORTING: 'warning', COMPLETED: 'success', FAILED: 'danger', CANCELLED: 'secondary',
};

function fmtBytes(n: number): string {
  if (!n) return '0';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function ImportDashboardPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const [stats, setStats] = useState<ImportDashboardStatsDto | null>(null);
  const [jobs, setJobs] = useState<PaginatedResult<ImportJobDto> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [jobName, setJobName] = useState('');
  const [files, setFiles] = useState<FileList | null>(null);
  const [folder, setFolder] = useState('/data/qms-drive-export');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [s, j] = await Promise.all([api.get<ImportDashboardStatsDto>('/import/stats'), api.get<PaginatedResult<ImportJobDto>>('/import', { pageSize: '20' })]);
      setStats(s); setJobs(j);
    } catch (err) { setError(err instanceof RequestError ? err.message : 'Failed to load.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function runDemo() {
    setBusy(true);
    try { const detail = await api.post<{ id: string }>('/import/demo'); toast.success(t('import.demo_done')); window.location.href = `/import/${detail.id}`; }
    catch (err) { toast.error(err instanceof RequestError ? err.message : 'Demo failed.'); }
    finally { setBusy(false); }
  }

  async function doUpload() {
    if (!files?.length) return;
    setBusy(true);
    try {
      const fd = new FormData();
      if (jobName) fd.append('name', jobName);
      for (const f of Array.from(files)) fd.append('files', f);
      const detail = await uploadFile<{ id: string }>('/import', fd);
      toast.success(t('import.created')); setUploadOpen(false); setJobName(''); setFiles(null);
      window.location.href = `/import/${detail.id}`;
    } catch (err) { toast.error(err instanceof RequestError ? err.message : 'Upload failed.'); }
    finally { setBusy(false); }
  }

  async function doScan() {
    setBusy(true);
    try {
      const detail = await api.post<{ id: string }>('/import/scan', { sourceLocation: folder, name: jobName || undefined });
      toast.success(t('import.created')); setScanOpen(false); window.location.href = `/import/${detail.id}`;
    } catch (err) { toast.error(err instanceof RequestError ? err.message : 'Scan failed.'); }
    finally { setBusy(false); }
  }

  const canStart = hasPermission('imports.start');

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <PageHeader
        title={t('page.import')}
        description={t('page.import_desc')}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="size-4" /></Button>
            {canStart ? (
              <>
                <Button variant="outline" size="sm" onClick={() => { setJobName(''); setFiles(null); setUploadOpen(true); }}><Upload className="size-4" /> {t('import.upload')}</Button>
                <Button variant="outline" size="sm" onClick={() => { setJobName(''); setScanOpen(true); }}><FileUp className="size-4" /> {t('import.scan_folder')}</Button>
                <Button size="sm" onClick={() => void runDemo()} disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} {t('import.run_demo')}</Button>
              </>
            ) : null}
          </div>
        }
      />

      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label={t('import.imported')} value={stats?.importedFiles ?? 0} tone="text-success-fg" />
        <StatCard label={t('import.pending_review')} value={stats?.pendingReview ?? 0} tone="text-warning-fg" />
        <StatCard label={t('import.duplicates')} value={stats?.duplicates ?? 0} />
        <StatCard label={t('import.failed')} value={(stats?.failedJobs ?? 0) + (stats?.errors ?? 0)} tone="text-danger-fg" />
        <StatCard label={t('import.processed')} value={stats?.completedJobs ?? 0} />
        <StatCard label={t('import.storage')} value={fmtBytes(stats?.storageBytes ?? 0)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Breakdown title={t('import.by_format')} data={stats?.byFormat ?? {}} />
        <Breakdown title={t('import.by_department')} data={stats?.byDepartment ?? {}} />
        <Breakdown title={t('import.by_category')} data={stats?.byCategory ?? {}} />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3 text-sm font-semibold">{t('import.jobs')}</div>
        {loading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-md bg-muted" />)}</div>
        ) : !jobs || jobs.items.length === 0 ? (
          <EmptyState title={t('import.no_jobs')} />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50"><tr>
              <Th>{t('common.name')}</Th><Th>{t('common.status')}</Th><Th>{t('import.progress')}</Th>
              <Th>{t('import.imported')}</Th><Th>{t('import.duplicates')}</Th><Th>{t('common.date')}</Th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {jobs.items.map((job) => (
                <tr key={job.id} className="hover:bg-accent/40">
                  <td className="px-4 py-3"><Link href={`/import/${job.id}`} className="font-medium text-foreground hover:underline">{job.name ?? job.sourceLocation ?? job.id.slice(0, 8)}</Link><div className="text-xs text-muted-foreground">{job.source}</div></td>
                  <td className="px-4 py-3"><Badge variant={JOB_TONE[job.status] ?? 'secondary'}>{t(`import.status.${job.status}`, job.status)}</Badge></td>
                  <td className="px-4 py-3"><div className="h-2 w-24 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${job.progress}%` }} /></div><span className="text-xs text-muted-foreground">{job.progress}%</span></td>
                  <td className="px-4 py-3 text-muted-foreground">{job.imported}/{job.processed}</td>
                  <td className="px-4 py-3 text-muted-foreground">{job.duplicates}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(job.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('import.new_import')}</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2"><Label htmlFor="jn">{t('common.name')}</Label><Input id="jn" value={jobName} onChange={(e) => setJobName(e.target.value)} /></div>
            <div className="flex flex-col gap-2"><Label htmlFor="fl">{t('import.select_files')}</Label><Input id="fl" type="file" multiple onChange={(e) => setFiles(e.target.files)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => void doUpload()} disabled={busy || !files?.length}>{busy ? <Loader2 className="size-4 animate-spin" /> : <PlusCircle className="size-4" />} {t('import.upload')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={scanOpen} onOpenChange={setScanOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('import.scan_folder')}</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2"><Label htmlFor="jn2">{t('common.name')}</Label><Input id="jn2" value={jobName} onChange={(e) => setJobName(e.target.value)} /></div>
            <div className="flex flex-col gap-2"><Label htmlFor="fld">Folder path</Label><Textarea id="fld" value={folder} onChange={(e) => setFolder(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScanOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => void doScan()} disabled={busy || !folder.trim()}>{busy ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />} {t('import.start')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Th({ children }: { children: ReactNode }) { return <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">{children}</th>; }
function StatCard({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return <div className="rounded-lg border border-border bg-card p-4"><div className={`text-2xl font-semibold ${tone ?? ''}`}>{value}</div><div className="text-xs text-muted-foreground">{label}</div></div>;
}
function Breakdown({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = Math.max(1, ...entries.map(([, n]) => n));
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</div>
      {entries.length === 0 ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="size-4" /> —</div> : entries.map(([k, n]) => (
        <div key={k} className="mb-1.5 flex items-center gap-2 text-sm">
          <span className="w-28 truncate text-muted-foreground">{k}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary/70" style={{ width: `${(n / max) * 100}%` }} /></div>
          <span className="w-8 text-right text-xs tabular-nums">{n}</span>
        </div>
      ))}
    </div>
  );
}
