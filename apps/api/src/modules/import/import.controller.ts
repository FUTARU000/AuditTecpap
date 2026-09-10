import { Body, Controller, Delete, Get, Param, Post, Query, Req, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { MAX_UPLOAD_BYTES } from '@tecpap/config';
import { actorFromRequest } from '../../common/context/actor';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { StorageService } from '../storage/storage.service';
import { ImportJobService } from './import-job.service';
import { ImportReviewService } from './import-review.service';
import { ImportStatisticsService } from './import-statistics.service';
import { ImportDemoGenerator } from './demo/import-demo.generator';
import { ReviewItemDto, ScanImportDto, StartImportDto } from './dto/import.dto';

@ApiTags('import')
@Controller({ path: 'import', version: '1' })
export class ImportController {
  constructor(
    private readonly jobs: ImportJobService,
    private readonly review: ImportReviewService,
    private readonly statistics: ImportStatisticsService,
    private readonly storage: StorageService,
    private readonly demo: ImportDemoGenerator,
  ) {}

  @Get('stats')
  @Permissions('imports.stats')
  @ApiOperation({ summary: 'Import dashboard statistics' })
  dashboard(@Req() req: Request) {
    return this.statistics.dashboard(req.dataScope);
  }

  @Get()
  @Permissions('imports.read')
  @ApiOperation({ summary: 'List import jobs' })
  list(@Query() query: { page?: number; pageSize?: number; status?: string }, @Req() req: Request) {
    return this.jobs.list(req.dataScope, req.user!.id, query);
  }

  @Post()
  @Permissions('imports.start')
  @UseInterceptors(FilesInterceptor('files', 50, { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  @ApiOperation({ summary: 'Start an import job from uploaded files' })
  async upload(@UploadedFiles() files: Express.Multer.File[], @Body() dto: StartImportDto, @Req() req: Request) {
    if (!files?.length) return { error: 'No files uploaded' };
    // Folder-relative paths (from webkitdirectory) arrive as a JSON array in the
    // `paths` form field — multer strips directory info from originalname.
    const relPaths = dto.paths ? (JSON.parse(dto.paths) as string[]) : undefined;
    const uploadFiles = files.map((f, i) => {
      const raw = relPaths?.[i] ?? f.originalname;
      const normalized = raw.replace(/\\/g, '/');
      const base = normalized.split('/').pop() || normalized;
      return { name: base, buffer: f.buffer, mimeType: f.mimetype, originalPath: normalized };
    });
    return this.jobs.runUpload(actorFromRequest(req), uploadFiles, dto.name);
  }

  @Post('scan')
  @Permissions('imports.start')
  @ApiOperation({ summary: 'Scan a server-mounted folder or a configured Google Drive folder' })
  scan(@Body() dto: ScanImportDto, @Req() req: Request) {
    // Defaults to LOCAL so pre-existing callers that never sent `source` keep working unchanged.
    return this.jobs.runScan(actorFromRequest(req), dto.source ?? 'LOCAL', dto.sourceLocation ?? '', dto.name);
  }

  @Post('demo')
  @Permissions('imports.start')
  @ApiOperation({ summary: 'Run the demonstration migration (sample Word/Excel/PDF/PowerPoint)' })
  async runDemo(@Req() req: Request) {
    const actor = actorFromRequest(req);
    const files = await this.demo.generate('PROD');
    const detail = await this.jobs.runUpload(actor, files, 'Demonstration migration');
    await this.review.approveAll(detail.id, actor);
    return this.jobs.detail(detail.id);
  }

  @Get(':id')
  @Permissions('imports.read')
  @ApiOperation({ summary: 'Import job detail (items + review queue)' })
  detail(@Param('id') id: string, @Req() req: Request) {
    return this.jobs.detail(id, req.dataScope, req.user!.id);
  }

  @Get(':id/progress')
  @Permissions('imports.read')
  @ApiOperation({ summary: 'Lightweight job progress' })
  progress(@Param('id') id: string) {
    return this.jobs.progress(id);
  }

  @Post(':id/retry')
  @Permissions('imports.cancel')
  @ApiOperation({ summary: 'Retry failed items in a job' })
  retry(@Param('id') id: string, @Req() req: Request) {
    return this.jobs.retry(id, actorFromRequest(req));
  }

  @Post(':id/approve-all')
  @Permissions('imports.review')
  @ApiOperation({ summary: 'Approve every reviewable item in a job' })
  approveAll(@Param('id') id: string, @Req() req: Request) {
    return this.review.approveAll(id, actorFromRequest(req));
  }

  @Post(':id/relationships')
  @Permissions('imports.review')
  @ApiOperation({ summary: 'Re-infer relationships among imported documents' })
  relationships(@Param('id') id: string, @Req() req: Request) {
    return this.jobs.finalize(id, actorFromRequest(req));
  }

  @Post(':id/cancel')
  @Permissions('imports.cancel')
  @ApiOperation({ summary: 'Cancel an import job' })
  cancel(@Param('id') id: string, @Req() req: Request) {
    return this.jobs.cancel(id, actorFromRequest(req));
  }

  @Delete(':id')
  @Permissions('imports.cancel')
  @ApiOperation({ summary: 'Delete an import job' })
  remove(@Param('id') id: string, @Req() req: Request) {
    return this.jobs.remove(id, actorFromRequest(req));
  }

  @Post('items/:itemId/review')
  @Permissions('imports.review')
  @ApiOperation({ summary: 'Review a single import item (approve/reject/merge/replace)' })
  reviewItem(@Param('itemId') itemId: string, @Body() dto: ReviewItemDto, @Req() req: Request) {
    return this.review.review(itemId, dto.decision, actorFromRequest(req), dto.overrides, dto.note);
  }

  @Get('items/:itemId/preview')
  @Permissions('imports.read')
  @ApiOperation({ summary: 'Presigned download URL for the original imported file' })
  async preview(@Param('itemId') itemId: string) {
    const key = await this.jobs.itemFileKey(itemId);
    return { url: await this.storage.presignedDownloadUrl(key) };
  }
}
