import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { actorFromRequest } from '../../common/context/actor';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CreateTemplateDto, ListTemplatesQuery, UpdateTemplateDto } from './dto/audit-templates.dto';
import { AuditTemplatesService } from './audit-templates.service';

@ApiTags('audit-templates')
@Controller({ path: 'audit-templates', version: '1' })
export class AuditTemplatesController {
  constructor(private readonly service: AuditTemplatesService) {}

  @Get()
  @Permissions('templates.read')
  @ApiOperation({ summary: 'List audit templates' })
  list(@Query() query: ListTemplatesQuery) { return this.service.list(query); }

  @Get(':id')
  @Permissions('templates.read')
  @ApiOperation({ summary: 'Template detail (sections + questions)' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  @Permissions('templates.create')
  @ApiOperation({ summary: 'Create an audit template with sections + questions' })
  create(@Body() dto: CreateTemplateDto, @Req() req: Request) { return this.service.create(dto, actorFromRequest(req)); }

  @Patch(':id')
  @Permissions('templates.update')
  @ApiOperation({ summary: 'Update a draft template' })
  update(@Param('id') id: string, @Body() dto: UpdateTemplateDto, @Req() req: Request) { return this.service.update(id, dto, actorFromRequest(req)); }

  @Post(':id/publish')
  @Permissions('templates.publish')
  @ApiOperation({ summary: 'Publish a template' })
  publish(@Param('id') id: string, @Req() req: Request) { return this.service.publish(id, actorFromRequest(req)); }

  @Post(':id/archive')
  @Permissions('templates.publish')
  @ApiOperation({ summary: 'Archive a template' })
  archive(@Param('id') id: string, @Req() req: Request) { return this.service.archive(id, actorFromRequest(req)); }

  @Post(':id/clone')
  @Permissions('templates.clone')
  @ApiOperation({ summary: 'Clone a template to a new draft' })
  clone(@Param('id') id: string, @Req() req: Request) { return this.service.clone(id, actorFromRequest(req)); }

  @Delete(':id')
  @Permissions('templates.delete')
  @ApiOperation({ summary: 'Delete an unused template' })
  remove(@Param('id') id: string, @Req() req: Request) { return this.service.remove(id, actorFromRequest(req)); }
}
