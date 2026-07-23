'use client';

import { ChevronLeft, ChevronRight, Inbox, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@tecpap/ui';
import { Skeleton } from '@/components/ui/skeleton';

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  total,
  canPrev,
  canNext,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  total: number;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (total === 0) {
    return null;
  }
  return (
    <div className="flex items-center justify-between px-1 py-2 text-sm text-muted-foreground">
      <span>
        {total} item{total === 1 ? '' : 's'}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onPrev} disabled={!canPrev}>
          <ChevronLeft className="size-4" /> Prev
        </Button>
        <span className="min-w-[5rem] text-center">
          Page {page} of {Math.max(totalPages, 1)}
        </span>
        <Button variant="outline" size="sm" onClick={onNext} disabled={!canNext}>
          Next <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Inbox className="size-5" />
      </span>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? <p className="max-w-sm text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlert className="size-5" />
      </span>
      <p className="text-sm font-medium text-foreground">{message}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}

export function TableSkeleton({ columns, rows = 6 }: { columns: number; rows?: number }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-4 px-4 py-3">
          {Array.from({ length: columns }).map((__, colIndex) => (
            <Skeleton key={colIndex} className="h-5 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

/** A header cell that toggles server-side sort when clicked. */
export function SortHeader({
  label,
  field,
  sort,
  onSort,
}: {
  label: string;
  field: string;
  sort: string | undefined;
  onSort: (next: string) => void;
}) {
  const isActive = sort === field || sort === `-${field}`;
  const descending = sort === `-${field}`;
  return (
    <button
      type="button"
      onClick={() => onSort(descending ? field : `-${field}`)}
      className={`inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide transition-colors hover:text-foreground ${
        isActive ? 'text-foreground' : 'text-muted-foreground'
      }`}
    >
      {label}
      <span className="text-[10px]">{isActive ? (descending ? '▼' : '▲') : '↕'}</span>
    </button>
  );
}
