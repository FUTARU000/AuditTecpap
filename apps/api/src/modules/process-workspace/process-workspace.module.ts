import { Module } from '@nestjs/common';
import { AuditsModule } from '../audits/audits.module';
import { BusinessObjectsModule } from '../business-objects/business-objects.module';
import { DocumentsModule } from '../documents/documents.module';
import { KpisModule } from '../kpis/kpis.module';
import { ProcessRisksModule } from '../process-risks/process-risks.module';
import { ProcessesModule } from '../processes/processes.module';
import { ProcessWorkspaceController } from './process-workspace.controller';
import { ProcessWorkspaceService } from './process-workspace.service';
import { ProcessAssignmentsService } from './process-assignments.service';

@Module({
  imports: [ProcessesModule, KpisModule, ProcessRisksModule, DocumentsModule, BusinessObjectsModule, AuditsModule],
  controllers: [ProcessWorkspaceController],
  providers: [ProcessWorkspaceService, ProcessAssignmentsService],
  exports: [ProcessWorkspaceService, ProcessAssignmentsService],
})
export class ProcessWorkspaceModule {}
