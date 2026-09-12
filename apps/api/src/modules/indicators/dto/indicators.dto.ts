import {
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import {
  INDICATOR_DIRECTION,
  INDICATOR_FREQUENCY,
  type IndicatorDirection,
  type IndicatorFrequency,
} from '@tecpap/types';

export class CreateIndicatorDto {
  @IsString() code!: string;
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @IsUUID() departmentId!: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsEnum(INDICATOR_DIRECTION) direction?: IndicatorDirection;
  @IsOptional() @IsNumber() target?: number;
  @IsOptional() @IsNumber() warningThreshold?: number;
  @IsOptional() @IsNumber() criticalThreshold?: number;
  @IsOptional() @IsEnum(INDICATOR_FREQUENCY) frequency?: IndicatorFrequency;
  @IsOptional() @IsUUID() responsibleUserId?: string | null;
}

export class UpdateIndicatorDto extends PartialType(CreateIndicatorDto) {}

export class ListIndicatorsQuery {
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() pageSize?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() sort?: string;
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsString() category?: string;
  /** Raw query-string boolean ('true'/'false') — the global ValidationPipe does not
   * coerce query strings to booleans, so this is parsed explicitly in the service. */
  @IsOptional() @IsIn(['true', 'false']) active?: string;
  @IsOptional() @IsEnum(['ON_TARGET', 'WARNING', 'CRITICAL', 'NO_DATA']) status?:
    'ON_TARGET' | 'WARNING' | 'CRITICAL' | 'NO_DATA';
}

export class RecordIndicatorValueDto {
  @IsNumber() value!: number;
  @IsInt() @Min(2000) @Max(2100) year!: number;
  @IsInt() @Min(1) @Max(12) periodMonth!: number;
  @IsOptional() @IsString() comment?: string;
}

export class IndicatorGridQuery {
  @IsOptional() @IsString() year?: string;
}
