import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { actorFromRequest } from '../../common/context/actor';
import { Permissions } from '../../common/decorators/permissions.decorator';
import {
  CreateIndicatorDto,
  IndicatorGridQuery,
  ListIndicatorsQuery,
  RecordIndicatorValueDto,
  UpdateIndicatorDto,
} from './dto/indicators.dto';
import { IndicatorsService } from './indicators.service';

@ApiTags('indicators')
@Controller({ path: 'indicators', version: '1' })
export class IndicatorsController {
  constructor(private readonly indicatorsService: IndicatorsService) {}

  @Get()
  @Permissions('indicators.read')
  @ApiOperation({ summary: 'List indicators (paginated, department-scoped, filtered)' })
  list(@Query() query: ListIndicatorsQuery, @Req() req: Request) {
    return this.indicatorsService.list(query, req.dataScope);
  }

  @Get(':id')
  @Permissions('indicators.read')
  @ApiOperation({ summary: 'Get an indicator with its full measurement history' })
  findOne(@Param('id') id: string, @Req() req: Request) {
    return this.indicatorsService.findOne(id, req.dataScope);
  }

  @Get(':id/values')
  @Permissions('indicators.values.read')
  @ApiOperation({ summary: "List an indicator's recorded values, oldest first" })
  listValues(@Param('id') id: string, @Req() req: Request) {
    return this.indicatorsService.listValues(id, req.dataScope);
  }

  @Get(':id/grid')
  @Permissions('indicators.values.read')
  @ApiOperation({ summary: 'The 12-month period grid for one year (defaults to the current year)' })
  getPeriodGrid(@Param('id') id: string, @Query() query: IndicatorGridQuery, @Req() req: Request) {
    const year = query.year ? Number(query.year) : new Date().getFullYear();
    return this.indicatorsService.getPeriodGrid(id, year, req.dataScope);
  }

  @Post()
  @Permissions('indicators.create')
  @ApiOperation({ summary: 'Create an indicator' })
  create(@Body() dto: CreateIndicatorDto, @Req() req: Request) {
    return this.indicatorsService.create(dto, actorFromRequest(req), req.dataScope);
  }

  @Patch(':id')
  @Permissions('indicators.update')
  @ApiOperation({ summary: 'Edit an indicator definition' })
  update(@Param('id') id: string, @Body() dto: UpdateIndicatorDto, @Req() req: Request) {
    return this.indicatorsService.update(id, dto, actorFromRequest(req), req.dataScope);
  }

  @Post(':id/activate')
  @Permissions('indicators.update')
  @ApiOperation({ summary: 'Activate an indicator' })
  activate(@Param('id') id: string, @Req() req: Request) {
    return this.indicatorsService.setActive(id, true, actorFromRequest(req), req.dataScope);
  }

  @Post(':id/deactivate')
  @Permissions('indicators.update')
  @ApiOperation({ summary: 'Deactivate an indicator' })
  deactivate(@Param('id') id: string, @Req() req: Request) {
    return this.indicatorsService.setActive(id, false, actorFromRequest(req), req.dataScope);
  }

  @Post(':id/values')
  @Permissions('indicators.values.create')
  @ApiOperation({ summary: 'Record a measured value — Pilots limited to their own department' })
  recordValue(@Param('id') id: string, @Body() dto: RecordIndicatorValueDto, @Req() req: Request) {
    return this.indicatorsService.recordValue(id, dto, actorFromRequest(req), req.dataScope);
  }
}
