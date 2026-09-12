import type {
  CapaActionStatus,
  CapaActionType,
  CapaPriority,
  CapaStatus,
  EffectivenessResult,
  VerificationResult,
} from './enums';

export interface CapaActionDto {
  id: string;
  capaId: string;
  title: string;
  description: string | null;
  actionType: CapaActionType;
  ownerId: string | null;
  ownerName: string | null;
  priority: CapaPriority;
  status: CapaActionStatus;
  dueDate: string | null;
  completedAt: string | null;
  completionComment: string | null;
  isOverdue: boolean;
  /** Derived from the latest CapaActionVerification, if any — NOT_VERIFIED when none exists yet. */
  verificationStatus: 'NOT_VERIFIED' | VerificationResult;
  /** Full per-action verification history, oldest first. Never overwritten —
   * a FAILED → reworked → PASSED cycle keeps both attempts visible. */
  verifications: CapaActionVerificationDto[];
  createdAt: string;
  updatedAt: string;
}

export interface CapaActionEvidenceDto {
  id: string;
  actionId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  comment: string | null;
  uploadedById: string;
  uploadedByName: string | null;
  createdAt: string;
}

export interface CapaActionVerificationDto {
  id: string;
  actionId: string;
  verifiedById: string;
  verifiedByName: string | null;
  result: VerificationResult;
  notes: string | null;
  verifiedAt: string;
}

export interface VerifyActionDto {
  result: VerificationResult;
  notes?: string | null;
}

export interface CapaDto {
  id: string;
  referenceNumber: string;
  title: string;
  description: string | null;
  sourceType: string;
  sourceId: string | null;
  findingId: string | null;
  findingTitle: string | null;
  departmentId: string;
  departmentName: string | null;
  processId: string | null;
  processName: string | null;
  ownerId: string | null;
  ownerName: string | null;
  createdById: string;
  createdByName: string | null;
  priority: CapaPriority;
  status: CapaStatus;
  targetDate: string | null;
  openedAt: string | null;
  submittedAt: string | null;
  verifiedAt: string | null;
  effectivenessDueDate: string | null;
  effectivenessReviewedAt: string | null;
  closedAt: string | null;
  closedById: string | null;
  closureComment: string | null;
  isOverdue: boolean;
  actionCount: number;
  completedActionCount: number;
  hasRootCause: boolean;
  hasVerification: boolean;
  hasEffectivenessReview: boolean;
  /** Phase 7.7: TECPAP visual workflow stage (computed from status). */
  stage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CapaDetailDto extends CapaDto {
  rootCause: {
    problemStatement: string | null;
    immediateCause: string | null;
    rootCause: string | null;
    contributingFactors: string | null;
    analysisNotes: string | null;
    useFiveWhys: boolean;
    useEightD: boolean;
    whySteps: Array<{ id: string; stepNumber: number; question: string; answer: string | null }>;
    eightD: {
      d1Team: string | null;
      d2ProblemDescription: string | null;
      d3InterimActions: string | null;
      d4RootCause: string | null;
      d5PermanentActions: string | null;
      d6Implementation: string | null;
      d7Prevention: string | null;
      d8Closure: string | null;
    } | null;
  } | null;
  actions: CapaActionDto[];
  /** Phase 3: full verification history, one row per attempt, oldest first. Never overwritten. */
  verifications: CapaVerificationDto[];
  effectiveness: {
    reviewedByName: string | null;
    result: EffectivenessResult;
    notes: string | null;
    reviewedAt: string;
  } | null;
}

export interface CapaVerificationDto {
  id: string;
  verifiedById: string;
  verifiedByName: string | null;
  result: VerificationResult;
  notes: string | null;
  verifiedAt: string;
}

export interface CreateCapaDto {
  title: string;
  description?: string | null;
  sourceType?: string;
  sourceId?: string | null;
  findingId?: string | null;
  departmentId: string;
  processId?: string | null;
  ownerId?: string | null;
  priority?: CapaPriority;
  targetDate?: string | null;
  effectivenessDueDate?: string | null;
}

export interface UpdateCapaDto {
  title?: string;
  description?: string | null;
  ownerId?: string | null;
  priority?: CapaPriority;
  targetDate?: string | null;
  effectivenessDueDate?: string | null;
}

export interface UpdateRootCauseDto {
  problemStatement?: string | null;
  immediateCause?: string | null;
  rootCause?: string | null;
  contributingFactors?: string | null;
  analysisNotes?: string | null;
  useFiveWhys?: boolean;
  useEightD?: boolean;
}

export interface CreateWhyStepDto {
  question: string;
  answer?: string | null;
}

export interface UpdateEightDDto {
  d1Team?: string | null;
  d2ProblemDescription?: string | null;
  d3InterimActions?: string | null;
  d4RootCause?: string | null;
  d5PermanentActions?: string | null;
  d6Implementation?: string | null;
  d7Prevention?: string | null;
  d8Closure?: string | null;
}

export interface CreateActionDto {
  title: string;
  description?: string | null;
  actionType?: CapaActionType;
  ownerId?: string | null;
  dueDate?: string | null;
  priority?: CapaPriority;
}

export interface UpdateActionDto {
  title?: string;
  description?: string | null;
  actionType?: CapaActionType;
  ownerId?: string | null;
  dueDate?: string | null;
  priority?: CapaPriority;
  status?: CapaActionStatus;
}

export interface VerificationDto {
  result: VerificationResult;
  notes?: string | null;
}

export interface EffectivenessDto {
  result: EffectivenessResult;
  notes?: string | null;
}

export interface FindingCapaDecisionDto {
  decision: 'REQUIRED' | 'NOT_REQUIRED';
  reason?: string | null;
}

export interface ListCapasQuery {
  page?: string;
  pageSize?: string;
  search?: string;
  sort?: string;
  status?: CapaStatus;
  departmentId?: string;
  processId?: string;
  ownerId?: string;
  priority?: CapaPriority;
  sourceType?: string;
  overdue?: string;
}
