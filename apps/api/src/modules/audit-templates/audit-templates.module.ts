import { Module } from '@nestjs/common';
import { AuditTemplatesController } from './audit-templates.controller';
import { AuditTemplatesService } from './audit-templates.service';

@Module({
  controllers: [AuditTemplatesController],
  providers: [AuditTemplatesService],
  exports: [AuditTemplatesService],
})
export class AuditTemplatesModule {}
