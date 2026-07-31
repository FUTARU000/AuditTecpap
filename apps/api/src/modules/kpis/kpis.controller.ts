import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { actorFromRequest } from '../../common/context/actor';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CreateKpiDto, ListKpisQuery, RecordKpiValueDto, UpdateKpiDto } from './dto/kpis.dto';
import { KpisService } from './kpis.service';

@ApiTags('kpis')
@Controller({ path: 'kpis', version: '1' })
export class KpisController {
  constructor(private readonly service: KpisService) {}

  @Get()
  @Permissions('kpis.read')
  @ApiOperation({ summary: 'List KPIs (scoped)' })
  list(@Query() query: ListKpisQuery, @Req() req: Request) { return this.service.list(query, req.dataScope); }

  @Get(':id')
  @Permissions('kpis.read')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  @Permissions('kpis.create')
  create(@Body() dto: CreateKpiDto, @Req() req: Request) { return this.service.create(dto, actorFromRequest(req)); }

  @Patch(':id')
  @Permissions('kpis.update')
  update(@Param('id') id: string, @Body() dto: UpdateKpiDto, @Req() req: Request) { return this.service.update(id, dto, actorFromRequest(req)); }

  @Patch(':id/value')
  @Permissions('kpis.update')
  @ApiOperation({ summary: 'Record a KPI measurement (future data-source hook)' })
  recordValue(@Param('id') id: string, @Body() dto: RecordKpiValueDto, @Req() req: Request) { return this.service.recordValue(id, dto, actorFromRequest(req)); }

  @Delete(':id')
  @Permissions('kpis.delete')
  remove(@Param('id') id: string, @Req() req: Request) { return this.service.remove(id, actorFromRequest(req)); }
}
