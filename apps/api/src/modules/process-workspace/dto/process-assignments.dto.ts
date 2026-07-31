import { IsString, IsUUID } from 'class-validator';

export class CreateAssignmentDto {
  @IsUUID() userId!: string;
  @IsString() role!: string; // OWNER | APPROVER | OPERATOR | AUDITOR | MANAGER
}
