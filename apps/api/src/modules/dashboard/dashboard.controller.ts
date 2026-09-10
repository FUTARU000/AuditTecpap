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
  @ApiOperation({ summary: 'Quality-management dashboard KPIs (role-scoped)' })
  stats(@Req() req: Request) {
    const user = req.user as { id?: string; permissions?: string[] } | undefined;
    return this.dashboardService.stats(req.dataScope, user?.id, user?.permissions);
  }
}
