import { Module } from '@nestjs/common';
import { DocumentRelationsService } from './document-relations.service';
import { DocumentVersionsService } from './document-versions.service';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentVersionsService, DocumentRelationsService],
  exports: [DocumentsService, DocumentVersionsService, DocumentRelationsService],
})
export class DocumentsModule {}
