'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AuditLogDto, PaginatedResult } from '@tecpap/types';
import { Badge } from '@tecpap/ui';
import { api } from '@/lib/api';
import { EmptyState, ErrorState, PageHeader, Pagination } from '@/components/admin/common';
import { useTranslation } from '@/lib/i18n';

export default function AuditLogPage() {
  const [data, setData] = useState<PaginatedResult<AuditLogDto> | null>(null);
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<PaginatedResult<AuditLogDto>>('/audit-logs', { page, pageSize: 20, sort: '-createdAt' });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit log.');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <PageHeader title={t('page.audit_log', 'Audit log')} description={t('page.audit_log_desc')} />

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {error ? (
          <ErrorState message={error} onRetry={() => void fetchLogs()} />
        ) : loading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-10 animate-pulse rounded-md bg-muted" />)}</div>
        ) : data && data.items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Timestamp</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Actor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Target</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map((entry) => (
                  <tr key={entry.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-foreground">{entry.actorName ?? 'System'}</td>
                    <td className="px-4 py-3"><Badge variant="outline" className="font-mono">{entry.action}</Badge></td>
                    <td className="px-4 py-3 text-muted-foreground">{entry.target ?? entry.entityId ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{entry.ipAddress ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title={t('empty.no_logs', 'No audit entries yet')} description="Administrative actions will appear here." />
        )}
        {data ? (
          <div className="border-t border-border px-4">
            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              total={data.total}
              canPrev={data.page > 1}
              canNext={data.page < data.totalPages}
              onPrev={() => setPage((current) => Math.max(1, current - 1))}
              onNext={() => setPage((current) => current + 1)}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
