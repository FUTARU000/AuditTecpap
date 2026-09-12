import type { IndicatorDirection, IndicatorEvaluationStatus } from '@tecpap/types';

export interface IndicatorEvaluationInput {
  direction: IndicatorDirection;
  /** The latest recorded value, or null if the indicator has no measurements yet. */
  value: number | null;
  target: number | null;
  warningThreshold: number | null;
  criticalThreshold: number | null;
}

/**
 * Deterministic indicator evaluation. Rules:
 *
 * - No recorded value at all → NO_DATA, regardless of configuration.
 * - HIGHER_IS_BETTER (thresholds are floors — value dropping below them is bad):
 *     value <= criticalThreshold → CRITICAL; value <= warningThreshold → WARNING; else ON_TARGET.
 * - LOWER_IS_BETTER (thresholds are ceilings — value rising above them is bad):
 *     value >= criticalThreshold → CRITICAL; value >= warningThreshold → WARNING; else ON_TARGET.
 * - TARGET_BASED (value should stay close to `target`; thresholds are the maximum
 *   allowed absolute deviation from it):
 *     |value - target| >= criticalThreshold → CRITICAL; >= warningThreshold → WARNING; else ON_TARGET.
 *   If `target` itself isn't configured, deviation can't be computed — ON_TARGET
 *   (there is nothing to fail against, so the indicator is not flagged).
 *
 * An unconfigured threshold (null) simply never triggers that band — an
 * indicator with no thresholds at all is always ON_TARGET once it has data.
 */
export function evaluateIndicator(input: IndicatorEvaluationInput): IndicatorEvaluationStatus {
  const { direction, value, target, warningThreshold, criticalThreshold } = input;
  if (value === null) return 'NO_DATA';

  if (direction === 'HIGHER_IS_BETTER') {
    if (criticalThreshold !== null && value <= criticalThreshold) return 'CRITICAL';
    if (warningThreshold !== null && value <= warningThreshold) return 'WARNING';
    return 'ON_TARGET';
  }

  if (direction === 'LOWER_IS_BETTER') {
    if (criticalThreshold !== null && value >= criticalThreshold) return 'CRITICAL';
    if (warningThreshold !== null && value >= warningThreshold) return 'WARNING';
    return 'ON_TARGET';
  }

  // TARGET_BASED
  if (target === null) return 'ON_TARGET';
  const deviation = Math.abs(value - target);
  if (criticalThreshold !== null && deviation >= criticalThreshold) return 'CRITICAL';
  if (warningThreshold !== null && deviation >= warningThreshold) return 'WARNING';
  return 'ON_TARGET';
}
