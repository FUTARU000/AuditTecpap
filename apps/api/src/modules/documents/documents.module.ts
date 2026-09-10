import { Module } from '@nestjs/common';
import { ActivityTimelineModule } from '../activity-timeline/activity-timeline.module';
import { ProductivityModule } from '../productivity/productivity.module';
import { DocumentRelationsService } from './document-relations.service';
import { DocumentVersionsService } from './document-versions.service';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { DocumentCommentsService } from './document-comments.service';
import { DocumentAcknowledgementsService } from './document-acknowledgements.service';
import { DocumentBookmarksService } from './document-bookmarks.service';
import { DocumentViewerService } from './document-viewer.service';
import { DocumentCompareService } from './document-compare.service';
import { DocumentInsightsService } from './document-insights.service';
import { DocumentHistoryService } from './document-history.service';
import { DocumentExportService } from './document-export.service';
import { DocumentBookmarksController, DocumentsExperienceController } from './document-experience.controller';

@Module({
  imports: [ActivityTimelineModule, ProductivityModule],
  // Experience controller first so its static routes (/insights, /advanced) are
  // registered before the base controller's @Get(':id') param route.
  controllers: [DocumentsExperienceController, DocumentsController, DocumentBookmarksController],
  providers: [
    DocumentsService,
    DocumentVersionsService,
    DocumentRelationsService,
    DocumentCommentsService,
    DocumentAcknowledgementsService,
    DocumentBookmarksService,
    DocumentViewerService,
    DocumentCompareService,
    DocumentInsightsService,
    DocumentHistoryService,
    DocumentExportService,
  ],
  exports: [DocumentsService, DocumentVersionsService, DocumentRelationsService],
})
export class DocumentsModule {}
