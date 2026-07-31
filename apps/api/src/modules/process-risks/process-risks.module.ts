import { Module } from '@nestjs/common';
import { ProcessRisksController } from './process-risks.controller';
import { ProcessRisksService } from './process-risks.service';

@Module({ controllers: [ProcessRisksController], providers: [ProcessRisksService], exports: [ProcessRisksService] })
export class ProcessRisksModule {}
