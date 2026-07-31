import { IsBoolean, IsInt, IsObject, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { PartialType } from '@nestjs/swagger';

export class CreateBusinessObjectTypeDto {
  @IsString() code!: string;
  @IsString() name!: string;
  @IsOptional() @IsString() icon?: string;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}

export class UpdateBusinessObjectTypeDto extends PartialType(CreateBusinessObjectTypeDto) {}

export class CreateBusinessObjectDto {
  @IsUUID() typeId!: string;
  @IsUUID() departmentId!: string;
  @IsOptional() @IsUUID() processId?: string;
  @IsString() name!: string;
  @IsString() code!: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsObject() attributes?: Record<string, unknown>;
  @IsOptional() @IsUUID() ownerId?: string;
}

export class UpdateBusinessObjectDto extends PartialType(CreateBusinessObjectDto) {}

export class ListBusinessObjectsQuery {
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() pageSize?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() sort?: string;
  @IsOptional() @IsUUID() typeId?: string;
  @IsOptional() @IsUUID() processId?: string;
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsString() status?: string;
}

export class CreateRelationshipDto {
  @IsString() sourceType!: string;
  @IsString() sourceId!: string;
  @IsString() targetType!: string;
  @IsString() targetId!: string;
  @IsString() type!: string;
  @IsOptional() @IsString() label?: string;
}
