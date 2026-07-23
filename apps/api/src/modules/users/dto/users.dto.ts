import { IsArray, IsEmail, IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { USER_STATUS, type UserStatus } from '@tecpap/types';

export class CreateUserDto {
  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  employeeNumber?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsUUID()
  roleId!: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsEnum(USER_STATUS)
  status?: UserStatus;
}

export class UpdateUserDto {
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() employeeNumber?: string | null;
  @IsOptional() @IsString() phone?: string | null;
  @IsOptional() @IsUUID() roleId?: string;
  @IsOptional() @IsUUID() departmentId?: string | null;
  @IsOptional() @IsEnum(USER_STATUS) status?: UserStatus;
}

export class ListUsersQuery {
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() pageSize?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() sort?: string;
  @IsOptional() @IsEnum(USER_STATUS) status?: UserStatus;
  @IsOptional() @IsUUID() roleId?: string;
  @IsOptional() @IsUUID() departmentId?: string;
}

export class BulkUserStatusDto {
  @IsArray()
  @IsUUID('4', { each: true })
  ids!: string[];

  @IsEnum(USER_STATUS)
  status!: UserStatus;
}
