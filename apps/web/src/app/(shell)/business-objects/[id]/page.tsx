'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, PlusCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { RELATIONSHIP_TYPES, type RelationshipType } from '@tecpap/config';
import type { BusinessObjectDto, BusinessRelationshipDto, DocumentDto, PaginatedResult } from '@tecpap/types';
import { Badge, Button } from '@tecpap/ui';
import { api, RequestError } from '@/lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ErrorState } from '@/components/admin/common';

export default function BusinessObjectDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [object, setObject] = useState<BusinessObjectDto | null>(null);
  const [relationships, setRelationships] = useState<BusinessRelationshipDto[]>([]);
  const [documents, setDocuments] = useState<DocumentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [targetId, setTargetId] = useState('');
  const [relType, setRelType] = useState<RelationshipType>('REFERENCES');
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [obj, rels] = await Promise.all([
        api.get<BusinessObjectDto>(`/business-objects/${id}`),
        api.get<BusinessRelationshipDto[]>(`/relationships?sourceType=business_object&sourceId=${id}`).catch(() => [] as BusinessRelationshipDto[]),
      ]);
      setObject(obj);
      setRelationships(rels);
    } catch (err) {
      setError(err instanceof RequestError ? err.message : 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchAll();
    api.get<PaginatedResult<DocumentDto>>('/documents', { pageSize: 100 }).then((result) => setDocuments(result.items)).catch(() => undefined);
  }, [fetchAll, id]);

  async function addRelationship() {
    if (!targetId) return;
    setSaving(true);
    try {
      await api.post('/relationships', { sourceType: 'business_object', sourceId: id, targetType: 'document', targetId, type: relType });
      toast.success('Linked');
      setTargetId('');
      await fetchAll();
    } catch (err) {
      toast.error(err instanceof RequestError ? err.message : 'Could not link.');
    } finally {
      setSaving(false);
    }
  }

  async function removeRelationship(relId: string) {
    try {
      await api.delete(`/relationships/${relId}`);
      await fetchAll();
    } catch (err) {
      toast.error(err instanceof RequestError ? err.message : 'Could not remove.');
    }
  }

  if (loading) return <div className="mx-auto max-w-4xl p-8 text-sm text-muted-foreground">Loading…</div>;
  if (error || !object) return <div className="mx-auto max-w-4xl"><ErrorState message={error ?? 'Not found'} /></div>;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <Link href="/business-objects" className="text-xs text-muted-foreground hover:underline">← Business objects</Link>
        <div className="mt-1 flex items-center gap-2">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">{object.name}</h2>
          <Badge variant={object.status === 'ACTIVE' ? 'success' : 'secondary'}>{object.status}</Badge>
        </div>
        <p className="font-mono text-sm text-muted-foreground">{object.code} · {object.typeName} · {object.departmentName}</p>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Details</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Process</dt><dd className="text-foreground">{object.processName ?? '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Owner</dt><dd className="text-foreground">{object.ownerName ?? '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Created</dt><dd className="text-foreground">{new Date(object.createdAt).toLocaleDateString()}</dd></div>
          </dl>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Attributes</h3>
          {object.attributes && Object.keys(object.attributes).length > 0 ? (
            <pre className="overflow-x-auto rounded bg-muted p-3 text-xs text-muted-foreground">{JSON.stringify(object.attributes, null, 2)}</pre>
          ) : <p className="text-sm text-muted-foreground">No custom attributes.</p>}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Related documents</h3>
        {relationships.length === 0 ? <p className="text-sm text-muted-foreground">No relationships.</p> : (
          <ul className="mb-3 space-y-2">
            {relationships.map((rel) => (
              <li key={rel.id} className="flex items-center justify-between gap-2 text-sm">
                <Link href={`/documents/${rel.targetId}`} className="font-mono text-xs text-foreground hover:underline">{rel.targetType} · {rel.targetId}</Link>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{rel.type}</Badge>
                  <button className="text-muted-foreground hover:text-destructive" onClick={() => void removeRelationship(rel.id)} aria-label="Remove"><Trash2 className="size-3.5" /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 grid gap-2 border-t border-border pt-3 sm:grid-cols-[1fr_auto_auto]">
          <Select value={targetId} onValueChange={setTargetId}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Link a document…" /></SelectTrigger>
            <SelectContent>{documents.map((document) => <SelectItem key={document.id} value={document.id}>{document.title} ({document.code})</SelectItem>)}</SelectContent>
          </Select>
          <Select value={relType} onValueChange={(value) => setRelType(value as RelationshipType)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{RELATIONSHIP_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => void addRelationship()} disabled={saving || !targetId}>{saving ? <Loader2 className="size-4 animate-spin" /> : <PlusCircle className="size-4" />} Link</Button>
        </div>
      </section>
    </div>
  );
}
