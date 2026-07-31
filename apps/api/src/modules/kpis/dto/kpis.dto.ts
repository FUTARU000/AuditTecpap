import { IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { PartialType } from '@nestjs/swagger';

export class CreateKpiDto {
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() formula?: string;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsNumber() target?: number;
  @IsOptional() @IsNumber() warningThreshold?: number;
  @IsOptional() @IsNumber() criticalThreshold?: number;
  @IsOptional() @IsNumber() currentValue?: number;
  @IsOptional() @IsString() trend?: string;
  @IsOptional() @IsString() frequency?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsUUID() responsibleUserId?: string;
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsUUID() processId?: string;
}

export class UpdateKpiDto extends PartialType(CreateKpiDto) {}

export class RecordKpiValueDto {
  @IsNumber() currentValue!: number;
  @IsOptional() @IsString() trend?: string;
}

export class ListKpisQuery {
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() pageSize?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() sort?: string;
  @IsOptional() @IsUUID() processId?: string;
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsString() status?: string;
}
