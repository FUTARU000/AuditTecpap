import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { actorFromRequest } from '../../common/context/actor';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { BusinessObjectTypesService } from './business-object-types.service';
import { CreateBusinessObjectTypeDto, UpdateBusinessObjectTypeDto } from './dto/business-objects.dto';

@ApiTags('business-object-types')
@Controller({ path: 'business-object-types', version: '1' })
export class BusinessObjectTypesController {
  constructor(private readonly service: BusinessObjectTypesService) {}

  @Get('active')
  @Permissions('business_objects.read')
  @ApiOperation({ summary: 'Active business-object types' })
  listActive() { return this.service.listActive(); }

  @Get()
  @Permissions('business_objects.read')
  @ApiOperation({ summary: 'List business-object types' })
  list(@Query('search') search?: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.service.list({ search, page, pageSize });
  }

  @Post()
  @Permissions('business_objects.create')
  @ApiOperation({ summary: 'Create a business-object type' })
  create(@Body() dto: CreateBusinessObjectTypeDto, @Req() req: Request) { return this.service.create(dto, actorFromRequest(req)); }

  @Patch(':id')
  @Permissions('business_objects.update')
  @ApiOperation({ summary: 'Update a business-object type' })
  update(@Param('id') id: string, @Body() dto: UpdateBusinessObjectTypeDto, @Req() req: Request) { return this.service.update(id, dto, actorFromRequest(req)); }

  @Delete(':id')
  @Permissions('business_objects.delete')
  @ApiOperation({ summary: 'Delete a business-object type (if unused)' })
  remove(@Param('id') id: string, @Req() req: Request) { return this.service.remove(id, actorFromRequest(req)); }
}
