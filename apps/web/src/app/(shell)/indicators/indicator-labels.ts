import type {
  IndicatorDirection,
  IndicatorEvaluationStatus,
  IndicatorFrequency,
} from '@tecpap/types';

type TranslateFn = (key: string, fallback?: string) => string;

const FREQUENCY_FALLBACK: Record<IndicatorFrequency, string> = {
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  SEMIANNUAL: 'Semiannual',
  ANNUAL: 'Annual',
};

/** Localized frequency label — EN/FR live in dictionaries.ts under 'indicators.frequency.*'. */
export function frequencyLabel(frequency: IndicatorFrequency, t: TranslateFn): string {
  return t(`indicators.frequency.${frequency}`, FREQUENCY_FALLBACK[frequency]);
}

const MONTH_FALLBACK = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** Localized 3-letter month abbreviation for calendar month 1-12 — EN/FR live in dictionaries.ts under 'indicators.month.*'. */
export function monthLabel(month: number, t: TranslateFn): string {
  return t(`indicators.month.${month}`, MONTH_FALLBACK[month - 1]);
}

export const DIRECTION_LABELS: Record<IndicatorDirection, string> = {
  HIGHER_IS_BETTER: 'Higher is better',
  LOWER_IS_BETTER: 'Lower is better',
  TARGET_BASED: 'Target-based',
};

export const STATUS_LABELS: Record<IndicatorEvaluationStatus, string> = {
  ON_TARGET: 'On target',
  WARNING: 'Warning',
  CRITICAL: 'Critical',
  NO_DATA: 'No data',
};

export function statusVariant(
  status: IndicatorEvaluationStatus,
): 'success' | 'warning' | 'danger' | 'outline' {
  if (status === 'ON_TARGET') return 'success';
  if (status === 'WARNING') return 'warning';
  if (status === 'CRITICAL') return 'danger';
  return 'outline';
}

export function statusLabel(status: IndicatorEvaluationStatus): string {
  return STATUS_LABELS[status];
}
