import { Module, OnModuleInit } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { DocumentsModule } from '../documents/documents.module';
import { AuditTemplatesModule } from '../audit-templates/audit-templates.module';
import { BusinessObjectsModule } from '../business-objects/business-objects.module';
import { ActivityTimelineModule } from '../activity-timeline/activity-timeline.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { ImportService } from './import.service';
import { ParserRegistry } from './parser.registry';
import { WordParser } from './parsers/word.parser';
import { ExcelParser } from './parsers/excel.parser';
import { PdfParser } from './parsers/pdf.parser';
import { PowerPointParser } from './parsers/powerpoint.parser';
import { LocalFolderProvider } from './providers/local-folder.provider';
import { GoogleDriveProvider } from './providers/google-drive.provider';
import { ImportScanner } from './import-scanner';
import { MetadataExtractor } from './metadata-extractor';
import { ClassificationEngine } from './classification.engine';
import { DuplicateDetector } from './duplicate.detector';
import { ImportStatisticsService } from './import-statistics.service';
import { RelationshipResolver } from './relationship.resolver';
import { ImportJobService } from './import-job.service';
import { ImportReviewService } from './import-review.service';
import { ImportDemoGenerator } from './demo/import-demo.generator';
import { ImportController } from './import.controller';

/**
 * Phase 7 import module. Reuses every existing QMS service (documents,
 * templates, relationships, timeline, audit log, storage) — it only orchestrates
 * parsing/classification and writes results into them. Adding a parser or a
 * source provider requires only declaring it here.
 */
@Module({
  imports: [PrismaModule, StorageModule, DocumentsModule, AuditTemplatesModule, BusinessObjectsModule, ActivityTimelineModule, AuditLogModule],
  controllers: [ImportController],
  providers: [
    ImportService,
    ParserRegistry,
    WordParser,
    ExcelParser,
    PdfParser,
    PowerPointParser,
    LocalFolderProvider,
    GoogleDriveProvider,
    ImportScanner,
    MetadataExtractor,
    ClassificationEngine,
    DuplicateDetector,
    ImportStatisticsService,
    RelationshipResolver,
    ImportJobService,
    ImportReviewService,
    ImportDemoGenerator,
  ],
  exports: [ImportService, ParserRegistry, ImportJobService],
})
export class ImportModule implements OnModuleInit {
  constructor(
    private readonly registry: ParserRegistry,
    private readonly word: WordParser,
    private readonly excel: ExcelParser,
    private readonly pdf: PdfParser,
    private readonly powerpoint: PowerPointParser,
  ) {}

  /** Pluggable parser registration — future parsers are added here only. */
  onModuleInit(): void {
    this.registry.register(this.word);
    this.registry.register(this.excel);
    this.registry.register(this.pdf);
    this.registry.register(this.powerpoint);
  }
}
