import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { actorFromRequest } from '../../common/context/actor';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CreateProcessDto, ListProcessesQuery, UpdateProcessDto } from './dto/processes.dto';
import { ProcessesService } from './processes.service';

@ApiTags('processes')
@Controller({ path: 'processes', version: '1' })
export class ProcessesController {
  constructor(private readonly processesService: ProcessesService) {}

  @Get()
  @Permissions('processes.read')
  @ApiOperation({ summary: 'List processes (paginated, scoped)' })
  list(@Query() query: ListProcessesQuery, @Req() req: Request) {
    return this.processesService.list(query, req.dataScope);
  }

  @Get(':id')
  @Permissions('processes.read')
  @ApiOperation({ summary: 'Get a process by id' })
  findOne(@Param('id') id: string, @Req() req: Request) {
    return this.processesService.findOne(id, req.dataScope);
  }

  @Post()
  @Permissions('processes.create')
  @ApiOperation({ summary: 'Create a process' })
  create(@Body() dto: CreateProcessDto, @Req() req: Request) {
    return this.processesService.create(dto, actorFromRequest(req));
  }

  @Patch(':id')
  @Permissions('processes.update')
  @ApiOperation({ summary: 'Update a process' })
  update(@Param('id') id: string, @Body() dto: UpdateProcessDto, @Req() req: Request) {
    return this.processesService.update(id, dto, actorFromRequest(req));
  }

  @Delete(':id')
  @Permissions('processes.delete')
  @ApiOperation({ summary: 'Archive (soft-delete) a process' })
  remove(@Param('id') id: string, @Req() req: Request) {
    return this.processesService.remove(id, actorFromRequest(req));
  }
}
