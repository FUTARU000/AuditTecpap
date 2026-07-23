import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../common/decorators/permissions.decorator';
import type { AuditLogQuery } from './audit-log.service';
import { AuditLogService } from './audit-log.service';

@ApiTags('audit-log')
@Controller({ path: 'audit-logs', version: '1' })
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @Permissions('audit-log.read')
  @ApiOperation({ summary: 'List immutable audit-log entries' })
  list(@Query() query: AuditLogQuery) {
    return this.auditLogService.list(query);
  }
}
