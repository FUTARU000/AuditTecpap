'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from '@tecpap/ui';
import { cn } from '@tecpap/ui';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

interface DatePickerProps {
  value: string | null; // ISO date string (yyyy-mm-dd)
  onChange: (value: string | null) => void;
  minDate?: string | null;
  maxDate?: string | null;
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  className?: string;
  id?: string;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Enterprise date picker — themed to match TECPAP UI (dark/light aware).
 * Features: month/year dropdowns, today/clear shortcuts, past-date prevention,
 * keyboard navigation, responsive grid, smooth transitions.
 */
export function DatePicker({
  value, onChange, minDate, maxDate, placeholder = 'Select date', disabled, clearable = true, className, id,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => parseDate(value)?.getFullYear() ?? new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => parseDate(value)?.getMonth() ?? new Date().getMonth());
  const ref = useRef<HTMLDivElement>(null);
  const min = parseDate(minDate ?? null);
  const max = parseDate(maxDate ?? null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    }
    if (open) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open, close]);

  useEffect(() => {
    function onEsc(e: KeyboardEvent) { if (e.key === 'Escape') close(); }
    if (open) document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [open, close]);

  // Sync view when value changes externally
  useEffect(() => {
    const d = parseDate(value);
    if (d) { setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); }
  }, [value]);

  const firstDay = new Date(viewYear, viewMonth, 1);
  const startDow = firstDay.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const today = new Date();
  const todayStr = toDateStr(today);

  const cells: Array<{ date: Date; str: string; inMonth: boolean } | null> = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(viewYear, viewMonth, d);
    cells.push({ date, str: toDateStr(date), inMonth: true });
  }

  function isDisabled(str: string): boolean {
    const d = parseDate(str);
    if (!d) return true;
    if (min && d < min) return true;
    if (max && d > max) return true;
    return false;
  }

  function select(str: string) {
    if (isDisabled(str)) return;
    onChange(str);
    close();
  }

  function prevMonth() { setViewMonth((m) => { if (m === 0) { setViewYear((y) => y - 1); return 11; } return m - 1; }); }
  function nextMonth() { setViewMonth((m) => { if (m === 11) { setViewYear((y) => y + 1); return 0; } return m + 1; }); }

  const displayValue = value ? new Date(value + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button" id={id} disabled={disabled} onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-left text-sm text-foreground transition-colors hover:bg-accent/50 disabled:cursor-not-allowed disabled:opacity-40"
        aria-haspopup="dialog" aria-expanded={open}
      >
        <Calendar className="size-4 shrink-0 text-muted-foreground" />
        <span className={displayValue ? '' : 'text-muted-foreground'}>{displayValue || placeholder}</span>
        {clearable && value ? (
          <span role="button" tabIndex={0} className="ml-auto rounded p-0.5 hover:bg-accent" onClick={(e) => { e.stopPropagation(); onChange(null); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onChange(null); } }}>
            <X className="size-3.5 text-muted-foreground" />
          </span>
        ) : null}
      </button>

      {open ? (
        <div role="dialog" className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border border-border bg-popover p-3 shadow-lg" style={{ animation: 'fadeIn 0.1s ease-out' }}>
          {/* Header: month/year nav */}
          <div className="mb-2 flex items-center gap-1">
            <Button size="icon" variant="ghost" className="size-7" onClick={prevMonth} aria-label="Previous month"><ChevronLeft className="size-4" /></Button>
            <select className="h-7 flex-1 rounded border border-input bg-background px-1 text-xs text-foreground" value={viewMonth} onChange={(e) => setViewMonth(Number(e.target.value))} aria-label="Month">
              {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
            <select className="h-7 w-20 rounded border border-input bg-background px-1 text-xs text-foreground" value={viewYear} onChange={(e) => setViewYear(Number(e.target.value))} aria-label="Year">
              {Array.from({ length: 12 }, (_, i) => viewYear - 6 + i).map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <Button size="icon" variant="ghost" className="size-7" onClick={nextMonth} aria-label="Next month"><ChevronRight className="size-4" /></Button>
          </div>

          {/* Day of week header */}
          <div className="mb-1 grid grid-cols-7 gap-0.5">
            {DAYS.map((d) => <div key={d} className="flex h-6 items-center justify-center text-[10px] font-medium text-muted-foreground">{d}</div>)}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((cell, i) => {
              if (!cell) return <div key={`empty-${i}`} className="h-8" />;
              const isToday = cell.str === todayStr;
              const isSelected = cell.str === value;
              const dis = isDisabled(cell.str);
              return (
                <button key={cell.str} type="button" disabled={dis} onClick={() => select(cell.str)}
                  className={cn(
                    'flex h-8 items-center justify-center rounded text-xs transition-colors',
                    dis ? 'cursor-not-allowed text-muted-foreground/30' : 'text-foreground hover:bg-accent',
                    isToday && !isSelected ? 'border border-primary/50 font-semibold' : '',
                    isSelected ? 'bg-primary font-semibold text-primary-foreground hover:bg-primary/90' : '',
                  )}
                  aria-label={cell.date.toDateString()} aria-pressed={isSelected}>
                  {cell.date.getDate()}
                </button>
              );
            })}
          </div>

          {/* Shortcuts */}
          <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { if (!isDisabled(todayStr)) select(todayStr); }}>Today</Button>
            {clearable ? <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { onChange(null); close(); }}>Clear</Button> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
