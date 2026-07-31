import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { actorFromRequest } from '../../common/context/actor';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CreateProcessRiskDto, ListRisksQuery, UpdateProcessRiskDto } from './dto/process-risks.dto';
import { ProcessRisksService } from './process-risks.service';

@ApiTags('process-risks')
@Controller({ path: 'process-risks', version: '1' })
export class ProcessRisksController {
  constructor(private readonly service: ProcessRisksService) {}

  @Get()
  @Permissions('risks.read')
  @ApiOperation({ summary: 'List process risks (department-scoped)' })
  list(@Query() query: ListRisksQuery, @Req() req: Request) { return this.service.list(query, req.dataScope); }

  @Get(':id')
  @Permissions('risks.read')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  @Permissions('risks.create')
  create(@Body() dto: CreateProcessRiskDto, @Req() req: Request) { return this.service.create(dto, actorFromRequest(req)); }

  @Patch(':id')
  @Permissions('risks.update')
  update(@Param('id') id: string, @Body() dto: UpdateProcessRiskDto, @Req() req: Request) { return this.service.update(id, dto, actorFromRequest(req)); }

  @Delete(':id')
  @Permissions('risks.delete')
  remove(@Param('id') id: string, @Req() req: Request) { return this.service.remove(id, actorFromRequest(req)); }
}
