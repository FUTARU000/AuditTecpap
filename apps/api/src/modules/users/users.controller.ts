import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { actorFromRequest } from '../../common/context/actor';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { BulkUserStatusDto, CreateUserDto, ListUsersQuery, UpdateUserDto } from './dto/users.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Permissions('users.read')
  @ApiOperation({ summary: 'List users (paginated, filtered, department-scoped)' })
  list(@Query() query: ListUsersQuery, @Req() req: Request) {
    return this.usersService.list(query, req.dataScope);
  }

  @Get(':id')
  @Permissions('users.read')
  @ApiOperation({ summary: 'Get a user by id' })
  findOne(@Param('id') id: string, @Req() req: Request) {
    return this.usersService.findOne(id, req.dataScope);
  }

  @Post()
  @Permissions('users.create')
  @ApiOperation({ summary: 'Create a user' })
  create(@Body() dto: CreateUserDto, @Req() req: Request) {
    return this.usersService.create(dto, actorFromRequest(req));
  }

  @Post('bulk-status')
  @Permissions('users.activate')
  @ApiOperation({ summary: 'Bulk activate / deactivate users' })
  bulkStatus(@Body() dto: BulkUserStatusDto, @Req() req: Request) {
    return this.usersService.bulkStatus(dto, actorFromRequest(req));
  }

  @Post(':id/reset-password')
  @Permissions('users.reset_password')
  @ApiOperation({ summary: 'Generate a password reset token for a user' })
  resetPassword(@Param('id') id: string, @Req() req: Request) {
    return this.usersService.resetPassword(id, actorFromRequest(req));
  }

  @Patch(':id')
  @Permissions('users.update')
  @ApiOperation({ summary: 'Update a user' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @Req() req: Request) {
    return this.usersService.update(id, dto, actorFromRequest(req));
  }

  @Delete(':id')
  @Permissions('users.delete')
  @ApiOperation({ summary: 'Soft-delete a user (never permanent)' })
  remove(@Param('id') id: string, @Req() req: Request) {
    return this.usersService.remove(id, actorFromRequest(req));
  }
}
