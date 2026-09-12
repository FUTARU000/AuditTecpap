/** Mirrors packages/types/src/enums.ts's IndicatorFrequency — duplicated as a plain
 * string union here (not imported) since @tecpap/config cannot depend on @tecpap/types
 * (types depends on config, not the reverse). */
type IndicatorFrequency = 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL';

/**
 * Which calendar months (1-12) accept a value for each frequency — the single
 * source of truth shared by the API (validation) and the web app (grid
 * rendering), so the two can never drift apart.
 *
 * QUARTERLY/SEMIANNUAL/ANNUAL periods are always represented by their
 * end-of-period month (Q1→Mar, Q2→Jun, Q3→Sep, Q4→Dec; H1→Jun, H2→Dec;
 * annual→Dec) while the UI still shows all 12 months for visual consistency.
 */
export const INDICATOR_FREQUENCY_VALID_MONTHS: Record<IndicatorFrequency, readonly number[]> = {
  MONTHLY: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  QUARTERLY: [3, 6, 9, 12],
  SEMIANNUAL: [6, 12],
  ANNUAL: [12],
};

export function isValidIndicatorPeriod(frequency: IndicatorFrequency, month: number): boolean {
  return INDICATOR_FREQUENCY_VALID_MONTHS[frequency].includes(month);
}

/** Snaps any calendar month to its frequency's representative period month. */
export function snapToIndicatorPeriod(frequency: IndicatorFrequency, month: number): number {
  const valid = INDICATOR_FREQUENCY_VALID_MONTHS[frequency];
  return valid.find((m) => m >= month) ?? valid[valid.length - 1]!;
}
