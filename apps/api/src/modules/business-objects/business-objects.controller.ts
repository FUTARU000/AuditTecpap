import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { actorFromRequest } from '../../common/context/actor';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { BusinessObjectsService } from './business-objects.service';
import { CreateBusinessObjectDto, ListBusinessObjectsQuery, UpdateBusinessObjectDto } from './dto/business-objects.dto';

@ApiTags('business-objects')
@Controller({ path: 'business-objects', version: '1' })
export class BusinessObjectsController {
  constructor(private readonly service: BusinessObjectsService) {}

  @Get()
  @Permissions('business_objects.read')
  @ApiOperation({ summary: 'List business objects (scoped)' })
  list(@Query() query: ListBusinessObjectsQuery, @Req() req: Request) { return this.service.list(query, req.dataScope); }

  @Get(':id')
  @Permissions('business_objects.read')
  @ApiOperation({ summary: 'Get a business object' })
  findOne(@Param('id') id: string, @Req() req: Request) { return this.service.findOne(id, req.dataScope); }

  @Post()
  @Permissions('business_objects.create')
  @ApiOperation({ summary: 'Create a business object' })
  create(@Body() dto: CreateBusinessObjectDto, @Req() req: Request) { return this.service.create(dto, actorFromRequest(req)); }

  @Patch(':id')
  @Permissions('business_objects.update')
  @ApiOperation({ summary: 'Update a business object' })
  update(@Param('id') id: string, @Body() dto: UpdateBusinessObjectDto, @Req() req: Request) { return this.service.update(id, dto, actorFromRequest(req)); }

  @Delete(':id')
  @Permissions('business_objects.delete')
  @ApiOperation({ summary: 'Delete a business object' })
  remove(@Param('id') id: string, @Req() req: Request) { return this.service.remove(id, actorFromRequest(req)); }
}
