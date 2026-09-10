import { Module } from '@nestjs/common';
import { ProductivityModule } from '../productivity/productivity.module';
import { CapaActionsService } from './capa-actions.service';
import { CapaController, FindingCapaController } from './capa.controller';
import { CapaFindingsService } from './capa-findings.service';
import { CapaReportsService } from './capa-reports.service';
import { CapaService } from './capa.service';

@Module({
  imports: [ProductivityModule],
  controllers: [CapaController, FindingCapaController],
  providers: [CapaService, CapaActionsService, CapaReportsService, CapaFindingsService],
  exports: [CapaService, CapaActionsService, CapaFindingsService],
})
export class CapaModule {}
