'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Pencil } from 'lucide-react';
import type { IndicatorDetailDto } from '@tecpap/types';
import { Badge, Button } from '@tecpap/ui';
import { api, RequestError } from '@/lib/api';
import { ErrorState } from '@/components/admin/common';
import { useAuth } from '@/lib/auth-context';
import { useTranslation } from '@/lib/i18n';
import { DIRECTION_LABELS, frequencyLabel } from '../indicator-labels';
import { IndicatorPeriodGrid } from '../indicator-period-grid';
import { IndicatorStatusBadge } from '../indicator-status-badge';

/** Minimal hand-rolled trend line — no charting library in this project. */
function Sparkline({ values }: { values: { value: number; measuredAt: string }[] }) {
  if (values.length < 2)
    return <p className="text-muted-foreground text-xs">Not enough data yet for a trend line.</p>;
  const width = 480;
  const height = 100;
  const pad = 8;
  const nums = values.map((v) => v.value);
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min || 1;
  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (width - pad * 2);
    const y = height - pad - ((v.value - min) / span) * (height - pad * 2);
    return `${x},${y}`;
  });
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="text-primary h-24 w-full"
      preserveAspectRatio="none"
    >
      <polyline points={points.join(' ')} fill="none" stroke="currentColor" strokeWidth={2} />
      {points.map((p, i) => {
        const [x, y] = p.split(',');
        return <circle key={i} cx={x} cy={y} r={2.5} fill="currentColor" />;
      })}
    </svg>
  );
}

export default function IndicatorDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const { hasPermission } = useAuth();
  const { t } = useTranslation();
  const canRecordValue = hasPermission('indicators.values.create');
  const canManage = hasPermission('indicators.update');

  const [indicator, setIndicator] = useState<IndicatorDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setIndicator(await api.get<IndicatorDetailDto>(`/indicators/${id}`));
    } catch (err) {
      setError(err instanceof RequestError ? err.message : 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (loading)
    return <div className="text-muted-foreground mx-auto max-w-4xl p-8 text-sm">Loading…</div>;
  if (error || !indicator)
    return (
      <div className="mx-auto max-w-4xl">
        <ErrorState message={error ?? 'Not found'} />
      </div>
    );

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div>
        <Link href="/indicators" className="text-muted-foreground text-xs hover:underline">
          ← Indicators
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-foreground text-2xl font-semibold tracking-tight">
                {indicator.name}
              </h2>
              <IndicatorStatusBadge status={indicator.status} />
              {!indicator.active ? <Badge variant="secondary">Inactive</Badge> : null}
            </div>
            <p className="text-muted-foreground text-sm">
              {indicator.code} · {indicator.departmentName}
              {indicator.category ? ` · ${indicator.category}` : ''} ·{' '}
              {frequencyLabel(indicator.frequency, t)}
              {indicator.responsibleName ? ` · ${indicator.responsibleName}` : ''}
            </p>
            {indicator.description ? (
              <p className="text-muted-foreground mt-1 text-sm">{indicator.description}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {canManage ? (
              <Link href="/indicators">
                <Button size="sm" variant="outline">
                  <Pencil className="size-4" /> Manage
                </Button>
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      <div className="border-border bg-card grid grid-cols-1 gap-4 rounded-lg border p-5 sm:grid-cols-3">
        <div>
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Current value
          </p>
          <p className="text-foreground mt-1 text-xl font-semibold">
            {indicator.latestValue ? `${indicator.latestValue.value}${indicator.unit ?? ''}` : '—'}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Target
          </p>
          <p className="text-foreground mt-1 text-xl font-semibold">
            {indicator.target !== null ? `${indicator.target}${indicator.unit ?? ''}` : '—'}
          </p>
          <p className="text-muted-foreground text-xs">{DIRECTION_LABELS[indicator.direction]}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Thresholds
          </p>
          <p className="text-foreground mt-1 text-sm">
            Warning: {indicator.warningThreshold ?? '—'}
            {indicator.unit ?? ''}
          </p>
          <p className="text-foreground text-sm">
            Critical: {indicator.criticalThreshold ?? '—'}
            {indicator.unit ?? ''}
          </p>
        </div>
      </div>

      <div className="border-border bg-card rounded-lg border p-5">
        <IndicatorPeriodGrid
          indicatorId={id}
          unit={indicator.unit}
          canEdit={canRecordValue}
          onValueSaved={() => void reload()}
        />
      </div>

      <div className="border-border bg-card rounded-lg border p-5">
        <h3 className="text-foreground mb-3 text-sm font-semibold">Trend</h3>
        <Sparkline values={indicator.values} />
      </div>

      <div className="border-border bg-card rounded-lg border">
        <div className="border-border border-b p-4">
          <h3 className="text-foreground text-sm font-semibold">Measurement history</h3>
        </div>
        {indicator.values.length === 0 ? (
          <p className="text-muted-foreground p-4 text-sm">No values recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-border bg-muted/50 border-b">
                <tr>
                  <th className="text-muted-foreground px-4 py-2 text-left text-xs font-medium uppercase tracking-wide">
                    Period
                  </th>
                  <th className="text-muted-foreground px-4 py-2 text-left text-xs font-medium uppercase tracking-wide">
                    Value
                  </th>
                  <th className="text-muted-foreground px-4 py-2 text-left text-xs font-medium uppercase tracking-wide">
                    Recorded by
                  </th>
                  <th className="text-muted-foreground px-4 py-2 text-left text-xs font-medium uppercase tracking-wide">
                    Comment
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {[...indicator.values].reverse().map((v) => (
                  <tr key={v.id}>
                    <td className="text-muted-foreground px-4 py-2">
                      {v.year}-{String(v.periodMonth).padStart(2, '0')}
                    </td>
                    <td className="text-foreground px-4 py-2 font-medium">
                      {v.value}
                      {indicator.unit ?? ''}
                    </td>
                    <td className="text-muted-foreground px-4 py-2">{v.recordedByName ?? '—'}</td>
                    <td className="text-muted-foreground px-4 py-2">{v.comment ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
