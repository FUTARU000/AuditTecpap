import type { IndicatorEvaluationStatus } from '@tecpap/types';
import { Badge } from '@tecpap/ui';
import { statusLabel, statusVariant } from './indicator-labels';

export function IndicatorStatusBadge({ status }: { status: IndicatorEvaluationStatus }) {
  return <Badge variant={statusVariant(status)}>{statusLabel(status)}</Badge>;
}
