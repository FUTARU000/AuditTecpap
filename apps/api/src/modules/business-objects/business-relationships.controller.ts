import { Body, Controller, Delete, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { actorFromRequest } from '../../common/context/actor';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { BusinessRelationshipsService } from './business-relationships.service';
import { CreateRelationshipDto } from './dto/business-objects.dto';

@ApiTags('relationships')
@Controller({ path: 'relationships', version: '1' })
export class BusinessRelationshipsController {
  constructor(private readonly service: BusinessRelationshipsService) {}

  @Get()
  @Permissions('business_objects.read')
  @ApiOperation({ summary: 'List relationships for an entity (?sourceType=&sourceId=)' })
  list(@Query('sourceType') sourceType: string, @Query('sourceId') sourceId: string) {
    return this.service.list(sourceType, sourceId);
  }

  @Post()
  @Permissions('business_objects.update')
  @ApiOperation({ summary: 'Create a relationship between any two entities' })
  create(@Body() dto: CreateRelationshipDto, @Req() req: Request) { return this.service.create(dto, actorFromRequest(req)); }

  @Delete(':id')
  @Permissions('business_objects.update')
  @ApiOperation({ summary: 'Remove a relationship' })
  remove(@Param('id') id: string, @Req() req: Request) { return this.service.remove(id, actorFromRequest(req)); }
}
