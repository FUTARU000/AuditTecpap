import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import {
  CAPA_PRIORITIES,
  CAPA_STATUSES,
  CAPA_ACTION_TYPES,
  CAPA_ACTION_STATUSES,
  VERIFICATION_RESULTS,
  EFFECTIVENESS_RESULTS,
  FINDING_CAPA_DECISIONS,
  type CapaPriority,
  type CapaStatus,
  type CapaActionType,
  type CapaActionStatus,
  type VerificationResult,
  type EffectivenessResult,
} from '@tecpap/config';

export class CreateCapaDto {
  @IsString() title!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() sourceType?: string;
  @IsOptional() @IsString() sourceId?: string;
  @IsOptional() @IsUUID() findingId?: string;
  @IsUUID() departmentId!: string;
  @IsOptional() @IsUUID() processId?: string;
  @IsOptional() @IsUUID() ownerId?: string;
  @IsOptional() @IsEnum(CAPA_PRIORITIES) priority?: CapaPriority;
  @IsOptional() @IsString() targetDate?: string;
  @IsOptional() @IsString() effectivenessDueDate?: string;
}

export class UpdateCapaDto extends PartialType(CreateCapaDto) {}

export class UpdateRootCauseDto {
  @IsOptional() @IsString() problemStatement?: string;
  @IsOptional() @IsString() immediateCause?: string;
  @IsOptional() @IsString() rootCause?: string;
  @IsOptional() @IsString() contributingFactors?: string;
  @IsOptional() @IsString() analysisNotes?: string;
  @IsOptional() @IsBoolean() useFiveWhys?: boolean;
  @IsOptional() @IsBoolean() useEightD?: boolean;
}

export class CreateWhyStepDto {
  @IsString() question!: string;
  @IsOptional() @IsString() answer?: string;
}
export class UpdateEightDDto {
  @IsOptional() @IsString() d1Team?: string;
  @IsOptional() @IsString() d2ProblemDescription?: string;
  @IsOptional() @IsString() d3InterimActions?: string;
  @IsOptional() @IsString() d4RootCause?: string;
  @IsOptional() @IsString() d5PermanentActions?: string;
  @IsOptional() @IsString() d6Implementation?: string;
  @IsOptional() @IsString() d7Prevention?: string;
  @IsOptional() @IsString() d8Closure?: string;
}

export class CreateActionDto {
  @IsString() title!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(CAPA_ACTION_TYPES) actionType?: CapaActionType;
  @IsOptional() @IsUUID() ownerId?: string;
  @IsOptional() @IsString() dueDate?: string;
  @IsOptional() @IsEnum(CAPA_PRIORITIES) priority?: CapaPriority;
}

export class UpdateActionDto extends PartialType(CreateActionDto) {
  @IsOptional() @IsEnum(CAPA_ACTION_STATUSES) status?: CapaActionStatus;
  @IsOptional() @IsString() completionComment?: string;
}

export class TransitionDto {
  @IsEnum(CAPA_STATUSES) status!: CapaStatus;
}
export class VerificationDto {
  @IsEnum(VERIFICATION_RESULTS) result!: VerificationResult;
  @IsOptional() @IsString() notes?: string;
}
export class VerifyActionDto {
  @IsEnum(VERIFICATION_RESULTS) result!: VerificationResult;
  @IsOptional() @IsString() notes?: string;
}
export class EffectivenessDto {
  @IsEnum(EFFECTIVENESS_RESULTS) result!: EffectivenessResult;
  @IsOptional() @IsString() notes?: string;
}
export class ClosureDto {
  @IsOptional() @IsString() closureComment?: string;
}
export class FindingDecisionDto {
  @IsEnum(FINDING_CAPA_DECISIONS) decision!: 'REQUIRED' | 'NOT_REQUIRED';
  @IsOptional() @IsString() reason?: string;
}

export class ListCapasQuery {
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() pageSize?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() sort?: string;
  @IsOptional() @IsEnum(CAPA_STATUSES) status?: CapaStatus;
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsUUID() processId?: string;
  @IsOptional() @IsUUID() ownerId?: string;
  @IsOptional() @IsEnum(CAPA_PRIORITIES) priority?: CapaPriority;
  @IsOptional() @IsString() sourceType?: string;
  @IsOptional() @IsString() overdue?: string;
}
