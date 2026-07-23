import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { actorFromRequest } from '../../common/context/actor';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CreateRoleDto, ListRolesQuery, UpdatePermissionsDto, UpdateRoleDto } from './dto/roles.dto';
import { RolesService } from './roles.service';

@ApiTags('roles')
@Controller({ path: 'roles', version: '1' })
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @Permissions('roles.read')
  @ApiOperation({ summary: 'List roles' })
  list(@Query() query: ListRolesQuery) {
    return this.rolesService.list(query);
  }

  @Get(':id')
  @Permissions('roles.read')
  @ApiOperation({ summary: 'Get a role by id' })
  findOne(@Param('id') id: string) {
    return this.rolesService.findOne(id);
  }

  @Post()
  @Permissions('roles.create')
  @ApiOperation({ summary: 'Create a custom role' })
  create(@Body() dto: CreateRoleDto, @Req() req: Request) {
    return this.rolesService.create(dto, actorFromRequest(req));
  }

  @Patch(':id')
  @Permissions('roles.update')
  @ApiOperation({ summary: 'Update a role (incl. permissions)' })
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto, @Req() req: Request) {
    return this.rolesService.update(id, dto, actorFromRequest(req));
  }

  @Patch(':id/permissions')
  @Permissions('roles.assign_permissions')
  @ApiOperation({ summary: 'Replace a role permission set' })
  setPermissions(@Param('id') id: string, @Body() dto: UpdatePermissionsDto, @Req() req: Request) {
    return this.rolesService.setPermissions(id, dto, actorFromRequest(req));
  }

  @Delete(':id')
  @Permissions('roles.delete')
  @ApiOperation({ summary: 'Delete a custom role (system roles are protected)' })
  remove(@Param('id') id: string, @Req() req: Request) {
    return this.rolesService.remove(id, actorFromRequest(req));
  }
}
