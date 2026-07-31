export interface ProcessRiskDto {
  id: string;
  processId: string;
  title: string;
  description: string | null;
  probability: number;
  impact: number;
  riskScore: number;
  ownerId: string | null;
  ownerName: string | null;
  mitigation: string | null;
  reviewDate: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProcessRiskDto {
  processId: string;
  title: string;
  description?: string | null;
  probability?: number;
  impact?: number;
  ownerId?: string | null;
  mitigation?: string | null;
  reviewDate?: string | null;
  status?: string;
}

export interface UpdateProcessRiskDto {
  title?: string;
  description?: string | null;
  probability?: number;
  impact?: number;
  ownerId?: string | null;
  mitigation?: string | null;
  reviewDate?: string | null;
  status?: string;
}
