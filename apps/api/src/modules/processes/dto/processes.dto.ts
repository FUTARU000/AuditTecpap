import { IsEnum, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import { PROCESS_STATUS, type ProcessStatus } from '@tecpap/types';

export class CreateProcessDto {
  @IsString() code!: string;
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @IsUUID() departmentId!: string;
  @IsOptional() @IsUUID() ownerId?: string;
  @IsOptional() @IsString() objectives?: string;
  @IsOptional() @IsString() scope?: string;
  @IsOptional() @IsObject() risks?: Record<string, unknown>;
  @IsOptional() @IsObject() opportunities?: Record<string, unknown>;
  @IsOptional() @IsObject() kpis?: Record<string, unknown>;
  @IsOptional() @IsEnum(PROCESS_STATUS) status?: ProcessStatus;
}

export class UpdateProcessDto extends PartialType(CreateProcessDto) {}

export class ListProcessesQuery {
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() pageSize?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() sort?: string;
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsEnum(PROCESS_STATUS) status?: ProcessStatus;
  @IsOptional() @IsUUID() ownerId?: string;
}
