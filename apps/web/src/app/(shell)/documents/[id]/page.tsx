'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  CheckCircle2,
  Download,
  Eye,
  FileText,
  GitCompare,
  Loader2,
  PlusCircle,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import type {
  AuditLogDto,
  DocumentDto,
  DocumentRelationDto,
  DocumentStatus,
  DocumentVersionDto,
  PaginatedResult,
} from '@tecpap/types';
import { RELATION_TYPES, RELATION_TYPE_LABELS, type RelationType } from '@tecpap/config';
import { Badge, Button, Input, Label } from '@tecpap/ui';
import { api, RequestError, uploadFile } from '@/lib/api';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ErrorState } from '@/components/admin/common';

const STATUS_TONE: Record<DocumentStatus, 'secondary' | 'warning' | 'success' | 'danger' | 'outline'> = {
  DRAFT: 'secondary',
  UNDER_REVIEW: 'warning',
  APPROVED: 'success',
  PUBLISHED: 'success',
  OBSOLETE: 'danger',
  ARCHIVED: 'outline',
};

const NEXT_STATUSES: Partial<Record<DocumentStatus, Array<{ status: DocumentStatus; label: string; permission: string }>>> = {
  DRAFT: [{ status: 'UNDER_REVIEW', label: 'Submit for review', permission: 'documents.update' }],
  UNDER_REVIEW: [{ status: 'APPROVED', label: 'Approve', permission: 'documents.approve' }],
  APPROVED: [{ status: 'PUBLISHED', label: 'Publish', permission: 'documents.publish' }],
  PUBLISHED: [{ status: 'OBSOLETE', label: 'Mark obsolete', permission: 'documents.archive' }],
};

export default function DocumentDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [doc, setDoc] = useState<DocumentDto | null>(null);
  const [versions, setVersions] = useState<DocumentVersionDto[]>([]);
  const [relations, setRelations] = useState<DocumentRelationDto[]>([]);
  const [activity, setActivity] = useState<AuditLogDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [versionLabel, setVersionLabel] = useState('');
  const [versionComment, setVersionComment] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [targetDocId, setTargetDocId] = useState('');
  const [relationType, setRelationType] = useState<RelationType>('REFERENCES');
  const [documentOptions, setDocumentOptions] = useState<DocumentDto[]>([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [document, versionList, relationList] = await Promise.all([
        api.get<DocumentDto>(`/documents/${id}`),
        api.get<DocumentVersionDto[]>(`/documents/${id}/versions`),
        api.get<DocumentRelationDto[]>(`/documents/${id}/relations`),
      ]);
      const logs = await api
        .get<PaginatedResult<AuditLogDto>>('/audit-logs', { pageSize: '10' })
        .then((result) => result.items)
        .catch(() => [] as AuditLogDto[]);
      setDoc(document);
      setVersions(versionList);
      setRelations(relationList);
      setActivity(logs.filter((entry) => entry.target?.includes(document.code) || entry.action.startsWith('document')));
    } catch (err) {
      setError(err instanceof RequestError ? err.message : 'Failed to load document.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    api.get<PaginatedResult<DocumentDto>>('/documents', { pageSize: 100 }).then((result) => setDocumentOptions(result.items.filter((item) => item.id !== id))).catch(() => undefined);
  }, [id]);

  async function changeStatus(status: DocumentStatus) {
    try {
      const updated = await api.post<DocumentDto>(`/documents/${id}/status`, { status });
      setDoc(updated);
      toast.success(`Status → ${status}`);
    } catch (err) {
      toast.error(err instanceof RequestError ? err.message : 'Status change failed.');
    }
  }

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !versionLabel) {
      toast.error('Enter a version label before uploading.');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('version', versionLabel);
      if (versionComment) formData.append('comment', versionComment);
      await uploadFile(`/documents/${id}/versions`, formData);
      toast.success('Version uploaded');
      setVersionLabel('');
      setVersionComment('');
      if (fileRef.current) fileRef.current.value = '';
      await fetchAll();
    } catch (err) {
      toast.error(err instanceof RequestError ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function approveVersion(versionId: string) {
    try {
      await api.patch(`/documents/${id}/versions/${versionId}/approve`);
      toast.success('Version approved');
      await fetchAll();
    } catch (err) {
      toast.error(err instanceof RequestError ? err.message : 'Approval failed.');
    }
  }

  async function download(versionId: string) {
    try {
      const { url } = await api.get<{ url: string }>(`/documents/${id}/versions/${versionId}/download`);
      window.open(url, '_blank');
    } catch (err) {
      toast.error(err instanceof RequestError ? err.message : 'Download failed.');
    }
  }

  async function addRelation() {
    if (!targetDocId) return;
    try {
      await api.post(`/documents/${id}/relations`, { targetDocumentId: targetDocId, type: relationType });
      toast.success('Relationship added');
      setTargetDocId('');
      await fetchAll();
    } catch (err) {
      toast.error(err instanceof RequestError ? err.message : 'Could not add relationship.');
    }
  }

  async function removeRelation(relationId: string) {
    try {
      await api.delete(`/documents/${id}/relations/${relationId}`);
      await fetchAll();
    } catch (err) {
      toast.error(err instanceof RequestError ? err.message : 'Could not remove.');
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-5xl p-8 text-sm text-muted-foreground">Loading document…</div>;
  }
  if (error || !doc) {
    return <div className="mx-auto max-w-5xl"><ErrorState message={error ?? 'Document not found'} /></div>;
  }

  const nextActions = NEXT_STATUSES[doc.status] ?? [];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">{doc.title}</h2>
            <Badge variant={STATUS_TONE[doc.status]}>{doc.status}</Badge>
          </div>
          <p className="font-mono text-sm text-muted-foreground">{doc.code} · v{doc.version}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/documents/${id}/viewer`} className="inline-flex h-8 items-center gap-1 rounded-md border border-input bg-background px-3 text-sm hover:bg-accent"><Eye className="size-4" /> Viewer</Link>
          <Link href={`/documents/${id}/compare`} className="inline-flex h-8 items-center gap-1 rounded-md border border-input bg-background px-3 text-sm hover:bg-accent"><GitCompare className="size-4" /> Compare</Link>
          {nextActions.map((action) => (
            <Button key={action.status} size="sm" onClick={() => void changeStatus(action.status)}>
              {action.status === 'UNDER_REVIEW' ? <Send className="size-4" /> : action.status === 'APPROVED' ? <CheckCircle2 className="size-4" /> : action.status === 'PUBLISHED' ? <ShieldCheck className="size-4" /> : <X className="size-4" />}
              {action.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-6">
          {/* Metadata */}
          <section className="rounded-lg border border-border bg-card p-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Metadata</h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Field label="Department" value={doc.departmentName} />
              <Field label="Category" value={doc.categoryName} />
              <Field label="Owner" value={doc.ownerName ?? '—'} />
              <Field label="Reviewer" value={doc.reviewerName ?? '—'} />
              <Field label="Approver" value={doc.approverName ?? '—'} />
              <Field label="Confidentiality" value={doc.confidentiality} />
              <Field label="Revision" value={String(doc.revision)} />
              <Field label="Effective" value={doc.effectiveDate ? new Date(doc.effectiveDate).toLocaleDateString() : '—'} />
              <Field label="Expires" value={doc.expirationDate ? new Date(doc.expirationDate).toLocaleDateString() : '—'} />
            </dl>
            {doc.keywords.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {doc.keywords.map((keyword) => <Badge key={keyword} variant="outline">{keyword}</Badge>)}
              </div>
            ) : null}
            {doc.description ? <p className="mt-4 text-sm text-muted-foreground">{doc.description}</p> : null}
          </section>

          {/* Current version + upload */}
          <section className="rounded-lg border border-border bg-card p-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Current version</h3>
            {doc.file ? (
              <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="size-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{doc.file.fileName}</p>
                    <p className="text-xs text-muted-foreground">{doc.file.mimeType} · {(doc.file.sizeBytes / 1024).toFixed(0)} KB · v{doc.file.version}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => void download(doc.file!.versionId)}><Download className="size-4" /> Download</Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No file uploaded yet.</p>
            )}

            <div className="mt-4 border-t border-border pt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Upload new version</p>
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-1"><Label htmlFor="vlabel">Version</Label><Input id="vlabel" className="w-32" placeholder="1.1" value={versionLabel} onChange={(event) => setVersionLabel(event.target.value)} /></div>
                <div className="flex flex-col gap-1"><Label htmlFor="vcomment">Comment</Label><Input id="vcomment" className="w-56" value={versionComment} onChange={(event) => setVersionComment(event.target.value)} /></div>
                <input ref={fileRef} type="file" className="hidden" onChange={(event) => void onFileChange(event)} />
                <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Upload file
                </Button>
              </div>
            </div>
          </section>

          {/* Version history */}
          <section className="rounded-lg border border-border bg-card p-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Version history</h3>
            {versions.length === 0 ? <p className="text-sm text-muted-foreground">No versions yet.</p> : (
              <ul className="space-y-2">
                {versions.map((version) => (
                  <li key={version.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-3 text-sm">
                    <div>
                      <p className="font-medium text-foreground">v{version.version} <span className="text-xs text-muted-foreground">(rev {version.revision})</span> {version.isActive ? <Badge variant="success" className="ml-1">active</Badge> : null}</p>
                      <p className="text-xs text-muted-foreground">{version.fileName} · {version.uploadedByName ?? '—'} · {new Date(version.createdAt).toLocaleString()}</p>
                      {version.comment ? <p className="text-xs text-muted-foreground">“{version.comment}”</p> : null}
                    </div>
                    <div className="flex gap-2">
                      {!version.approvedAt ? <Button variant="outline" size="sm" onClick={() => void approveVersion(version.id)}><CheckCircle2 className="size-4" /> Approve</Button> : null}
                      <Button variant="ghost" size="sm" onClick={() => void download(version.id)}><Download className="size-4" /></Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Side column */}
        <div className="flex flex-col gap-6">
          {/* Relations */}
          <section className="rounded-lg border border-border bg-card p-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Related documents</h3>
            {relations.length === 0 ? <p className="text-sm text-muted-foreground">No relationships.</p> : (
              <ul className="mb-3 space-y-2">
                {relations.map((relation) => (
                  <li key={relation.id} className="flex items-center justify-between gap-2 text-sm">
                    <a href={`/documents/${relation.targetDocumentId}`} className="truncate text-foreground hover:underline">{relation.targetTitle}</a>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px]">{RELATION_TYPE_LABELS[relation.type]}</Badge>
                      <button className="text-muted-foreground hover:text-destructive" onClick={() => void removeRelation(relation.id)} aria-label="Remove"><Trash2 className="size-3.5" /></button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="space-y-2 border-t border-border pt-3">
              <Select value={targetDocId} onValueChange={setTargetDocId}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Link to…" /></SelectTrigger>
                <SelectContent>{documentOptions.map((option) => <SelectItem key={option.id} value={option.id}>{option.title} ({option.code})</SelectItem>)}</SelectContent>
              </Select>
              <Select value={relationType} onValueChange={(value) => setRelationType(value as RelationType)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{RELATION_TYPES.map((type) => <SelectItem key={type} value={type}>{RELATION_TYPE_LABELS[type]}</SelectItem>)}</SelectContent>
              </Select>
              <Button size="sm" variant="outline" className="w-full" onClick={() => void addRelation()}><PlusCircle className="size-4" /> Add relationship</Button>
            </div>
          </section>

          {/* Timeline */}
          <section className="rounded-lg border border-border bg-card p-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Timeline</h3>
            {activity.length === 0 ? <p className="text-sm text-muted-foreground">No recent activity.</p> : (
              <ul className="space-y-2 text-sm">
                {activity.slice(0, 6).map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-2">
                    <span className="truncate"><span className="font-mono text-xs text-muted-foreground">{entry.action}</span>{entry.target ? <span className="ml-1 text-foreground">{entry.target}</span> : null}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Future audit placeholder */}
          <section className="rounded-lg border border-dashed border-border bg-card p-5">
            <h3 className="text-sm font-semibold text-foreground">Audit findings</h3>
            <p className="mt-1 text-xs text-muted-foreground">Findings & non-conformities from future audits will appear here.</p>
          </section>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value ?? '—'}</dd>
    </div>
  );
}
