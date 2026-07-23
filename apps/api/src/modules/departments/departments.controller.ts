import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { actorFromRequest } from '../../common/context/actor';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CreateDepartmentDto, ListDepartmentsQuery, UpdateDepartmentDto } from './dto/departments.dto';
import { DepartmentsService } from './departments.service';

@ApiTags('departments')
@Controller({ path: 'departments', version: '1' })
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  @Permissions('departments.read')
  @ApiOperation({ summary: 'List departments (paginated, department-scoped)' })
  list(@Query() query: ListDepartmentsQuery, @Req() req: Request) {
    return this.departmentsService.list(query, req.dataScope);
  }

  @Get('stats')
  @Permissions('departments.read')
  @ApiOperation({ summary: 'Department statistics' })
  stats() {
    return this.departmentsService.stats();
  }

  @Get(':id')
  @Permissions('departments.read')
  @ApiOperation({ summary: 'Get a department by id' })
  findOne(@Param('id') id: string, @Req() req: Request) {
    return this.departmentsService.findOne(id, req.dataScope);
  }

  @Post()
  @Permissions('departments.create')
  @ApiOperation({ summary: 'Create a department' })
  create(@Body() dto: CreateDepartmentDto, @Req() req: Request) {
    return this.departmentsService.create(dto, actorFromRequest(req));
  }

  @Patch(':id')
  @Permissions('departments.update')
  @ApiOperation({ summary: 'Update a department' })
  update(@Param('id') id: string, @Body() dto: UpdateDepartmentDto, @Req() req: Request) {
    return this.departmentsService.update(id, dto, actorFromRequest(req));
  }

  @Delete(':id')
  @Permissions('departments.delete')
  @ApiOperation({ summary: 'Delete a department' })
  remove(@Param('id') id: string, @Req() req: Request) {
    return this.departmentsService.remove(id, actorFromRequest(req));
  }
}
