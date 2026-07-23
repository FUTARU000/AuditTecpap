import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { DEPARTMENT_STATUS, type DepartmentStatus } from '@tecpap/types';

export class CreateDepartmentDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsEnum(DEPARTMENT_STATUS)
  status?: DepartmentStatus;

  @IsOptional()
  @IsUUID()
  managerId?: string | null;
}

export class UpdateDepartmentDto {
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
  @IsOptional() @IsEnum(DEPARTMENT_STATUS) status?: DepartmentStatus;
  @IsOptional() @IsUUID() managerId?: string | null;
}

export class ListDepartmentsQuery {
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() pageSize?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() sort?: string;
  @IsOptional() @IsEnum(DEPARTMENT_STATUS) status?: DepartmentStatus;
}
