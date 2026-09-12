'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { IndicatorPeriodGridDto } from '@tecpap/types';
import { Input } from '@tecpap/ui';
import { api, RequestError } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { monthLabel } from './indicator-labels';

/**
 * The Excel-like 12-month grid. Always shows Jan-Dec; a cell is either
 * "applicable" (editable, blank when no value yet — never a fabricated 0) or
 * visually dashed-out when the indicator's frequency doesn't use that month.
 */
export function IndicatorPeriodGrid({
  indicatorId,
  unit,
  canEdit,
  onValueSaved,
}: {
  indicatorId: string;
  unit: string | null;
  canEdit: boolean;
  onValueSaved?: () => void;
}) {
  const { t } = useTranslation();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [grid, setGrid] = useState<IndicatorPeriodGridDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [savingMonth, setSavingMonth] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.get<IndicatorPeriodGridDto>(`/indicators/${indicatorId}/grid`, {
        year,
      });
      setGrid(result);
      setDrafts({});
    } catch {
      setGrid(null);
    } finally {
      setLoading(false);
    }
  }, [indicatorId, year]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(month: number, raw: string) {
    const trimmed = raw.trim();
    if (trimmed === '') return;
    const numeric = Number(trimmed);
    if (Number.isNaN(numeric)) {
      toast.error('Enter a valid number.');
      return;
    }
    setSavingMonth(month);
    try {
      await api.post(`/indicators/${indicatorId}/values`, {
        value: numeric,
        year,
        periodMonth: month,
      });
      await load();
      onValueSaved?.();
    } catch (err) {
      toast.error(err instanceof RequestError ? err.message : 'Could not save value.');
    } finally {
      setSavingMonth(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-foreground text-sm font-semibold">
          {t('indicators.period_grid', 'Period values')}
        </h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setYear((y) => y - 1)}
            className="hover:bg-accent rounded-md p-1"
            aria-label="Previous year"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-foreground w-14 text-center text-sm font-medium">{year}</span>
          <button
            type="button"
            onClick={() => setYear((y) => y + 1)}
            className="hover:bg-accent rounded-md p-1"
            aria-label="Next year"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
      {loading && !grid ? (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-12">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="bg-muted h-16 animate-pulse rounded-md" />
          ))}
        </div>
      ) : !grid ? (
        <p className="text-muted-foreground text-sm">Could not load period values.</p>
      ) : (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-12">
          {grid.periods.map((cell) => {
            const draft = drafts[cell.month];
            const displayValue =
              draft !== undefined ? draft : (cell.value?.value?.toString() ?? '');
            return (
              <div
                key={cell.month}
                className={`flex flex-col items-center gap-1 rounded-md border p-2 text-center ${cell.applicable ? 'border-border' : 'bg-muted/30 border-transparent'}`}
              >
                <span className="text-muted-foreground text-[10px] font-medium uppercase">
                  {monthLabel(cell.month, t)}
                </span>
                {cell.applicable ? (
                  <Input
                    type="number"
                    className="h-7 w-full px-1 text-center text-xs"
                    value={displayValue}
                    disabled={!canEdit || savingMonth === cell.month}
                    onChange={(e) => setDrafts((d) => ({ ...d, [cell.month]: e.target.value }))}
                    onBlur={(e) => {
                      if (draft !== undefined) void save(cell.month, e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    }}
                  />
                ) : (
                  <span
                    className="text-muted-foreground/40 flex h-7 w-full items-center justify-center text-sm"
                    aria-label="Not applicable"
                  >
                    —
                  </span>
                )}
                {savingMonth === cell.month ? (
                  <Loader2 className="text-muted-foreground size-3 animate-spin" />
                ) : null}
              </div>
            );
          })}
        </div>
      )}
      {unit ? (
        <p className="text-muted-foreground text-xs">
          {t('indicators.unit_label', 'Unit')}: {unit}
        </p>
      ) : null}
    </div>
  );
}
