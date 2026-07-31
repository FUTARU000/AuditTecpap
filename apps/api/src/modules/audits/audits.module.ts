import { Module } from '@nestjs/common';
import { AuditEvidenceService } from './audit-evidence.service';
import { AuditReportsService } from './audit-reports.service';
import { AuditsController } from './audits.controller';
import { AuditsService } from './audits.service';
import { FindingsService } from './findings.service';

@Module({
  controllers: [AuditsController],
  providers: [AuditsService, FindingsService, AuditEvidenceService, AuditReportsService],
  exports: [AuditsService, FindingsService, AuditEvidenceService, AuditReportsService],
})
export class AuditsModule {}
