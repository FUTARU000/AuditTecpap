export interface KpiDto {
  id: string;
  name: string;
  description: string | null;
  formula: string | null;
  unit: string | null;
  target: number | null;
  warningThreshold: number | null;
  criticalThreshold: number | null;
  currentValue: number | null;
  trend: string | null;
  frequency: string;
  status: string;
  responsibleUserId: string | null;
  responsibleName: string | null;
  departmentId: string | null;
  departmentName: string | null;
  processId: string | null;
  processName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateKpiDto {
  name: string;
  description?: string | null;
  formula?: string | null;
  unit?: string | null;
  target?: number | null;
  warningThreshold?: number | null;
  criticalThreshold?: number | null;
  currentValue?: number | null;
  trend?: string | null;
  frequency?: string;
  status?: string;
  responsibleUserId?: string | null;
  departmentId?: string | null;
  processId?: string | null;
}

export interface UpdateKpiDto {
  name?: string;
  description?: string | null;
  formula?: string | null;
  unit?: string | null;
  target?: number | null;
  warningThreshold?: number | null;
  criticalThreshold?: number | null;
  frequency?: string;
  status?: string;
  responsibleUserId?: string | null;
  departmentId?: string | null;
  processId?: string | null;
}

export interface RecordKpiValueDto {
  currentValue: number;
  trend?: string | null;
}
