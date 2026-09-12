import type { IndicatorDirection, IndicatorFrequency } from './enums';

/** Deterministic evaluation of the latest value against the indicator's configured thresholds. */
export type IndicatorEvaluationStatus = 'ON_TARGET' | 'WARNING' | 'CRITICAL' | 'NO_DATA';

export interface IndicatorValueDto {
  id: string;
  value: number;
  year: number;
  /** Calendar month (1-12) — the frequency's representative period month. */
  periodMonth: number;
  measuredAt: string;
  comment: string | null;
  recordedById: string | null;
  recordedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IndicatorDto {
  id: string;
  code: string;
  name: string;
  description: string | null;
  departmentId: string;
  departmentName: string | null;
  category: string | null;
  unit: string | null;
  direction: IndicatorDirection;
  target: number | null;
  warningThreshold: number | null;
  criticalThreshold: number | null;
  frequency: IndicatorFrequency;
  responsibleUserId: string | null;
  responsibleName: string | null;
  active: boolean;
  createdById: string;
  createdByName: string | null;
  latestValue: IndicatorValueDto | null;
  status: IndicatorEvaluationStatus;
  createdAt: string;
  updatedAt: string;
}

/** Full indicator with its complete measurement history, oldest first. */
export interface IndicatorDetailDto extends IndicatorDto {
  values: IndicatorValueDto[];
}

export interface CreateIndicatorDto {
  code: string;
  name: string;
  description?: string | null;
  departmentId: string;
  category?: string | null;
  unit?: string | null;
  direction?: IndicatorDirection;
  target?: number | null;
  warningThreshold?: number | null;
  criticalThreshold?: number | null;
  frequency?: IndicatorFrequency;
  responsibleUserId?: string | null;
}

export interface UpdateIndicatorDto {
  code?: string;
  name?: string;
  description?: string | null;
  departmentId?: string;
  category?: string | null;
  unit?: string | null;
  direction?: IndicatorDirection;
  target?: number | null;
  warningThreshold?: number | null;
  criticalThreshold?: number | null;
  frequency?: IndicatorFrequency;
  responsibleUserId?: string | null;
}

export interface ListIndicatorsQuery {
  page?: string;
  pageSize?: string;
  search?: string;
  sort?: string;
  departmentId?: string;
  category?: string;
  /** 'true' | 'false' — sent as a query string, not a JSON boolean. */
  active?: string;
  status?: IndicatorEvaluationStatus;
}

export interface RecordIndicatorValueDto {
  value: number;
  year: number;
  /** Calendar month (1-12) — must be one of the indicator's frequency's valid periods. */
  periodMonth: number;
  comment?: string | null;
}

/** The 12-month grid for one year — always 12 entries; `applicable` marks which
 * ones the indicator's frequency actually accepts a value for. */
export interface IndicatorPeriodCellDto {
  month: number;
  applicable: boolean;
  value: IndicatorValueDto | null;
}

export interface IndicatorPeriodGridDto {
  year: number;
  frequency: IndicatorFrequency;
  periods: IndicatorPeriodCellDto[];
}
