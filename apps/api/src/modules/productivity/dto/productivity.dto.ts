import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class AddFavoriteDto {
  @IsString() @MaxLength(40) entityType!: string;
  @IsString() @MaxLength(100) entityId!: string;
  @IsString() @MaxLength(200) label!: string;
  @IsString() @MaxLength(300) href!: string;
  @IsOptional() @IsString() @MaxLength(60) icon?: string;
}

export class RecordRecentDto {
  @IsString() @MaxLength(40) entityType!: string;
  @IsString() @MaxLength(100) entityId!: string;
  @IsString() @MaxLength(200) label!: string;
  @IsString() @MaxLength(300) href!: string;
}

export class UpsertSubscriptionDto {
  @IsString() @MaxLength(60) reportType!: string;
  @IsEnum(['DAILY', 'WEEKLY', 'MONTHLY']) frequency!: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  @IsOptional() @IsString() channel?: string;
}

export class TaskActionDto {
  @IsString() @MaxLength(40) entityType!: string;
  @IsString() @MaxLength(100) entityId!: string;
  @IsOptional() completed?: boolean;
}
