import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { PartialType } from '@nestjs/swagger';

export class CreateProcessRiskDto {
  @IsUUID() processId!: string;
  @IsString() title!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsInt() @Min(1) @Max(5) probability?: number;
  @IsOptional() @IsInt() @Min(1) @Max(5) impact?: number;
  @IsOptional() @IsUUID() ownerId?: string;
  @IsOptional() @IsString() mitigation?: string;
  @IsOptional() @IsDateString() reviewDate?: string;
  @IsOptional() @IsString() status?: string;
}

export class UpdateProcessRiskDto extends PartialType(CreateProcessRiskDto) {}

export class ListRisksQuery {
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() pageSize?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() sort?: string;
  @IsOptional() @IsUUID() processId?: string;
  @IsOptional() @IsString() status?: string;
}
