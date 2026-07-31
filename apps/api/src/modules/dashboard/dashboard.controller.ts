import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@Controller({ path: 'dashboard', version: '1' })
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @Permissions('dashboard.read')
  @ApiOperation({ summary: 'Quality-management dashboard KPIs' })
  stats(@Req() req: Request) {
    return this.dashboardService.stats(req.dataScope);
  }
}
