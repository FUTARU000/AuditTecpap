import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { actorFromRequest } from '../../common/context/actor';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { departmentScopeWhere } from '../../common/scoping/scope';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentCommentsService } from './document-comments.service';
import { DocumentAcknowledgementsService } from './document-acknowledgements.service';
import { DocumentBookmarksService } from './document-bookmarks.service';
import { DocumentViewerService } from './document-viewer.service';
import { DocumentCompareService } from './document-compare.service';
import { DocumentInsightsService } from './document-insights.service';
import { DocumentHistoryService } from './document-history.service';
import { DocumentExportService } from './document-export.service';
import { CompareVersionsDto, CreateBookmarkDto, CreateCommentDto, UpdateCommentDto } from './dto/document-experience.dto';

const uid = (req: Request) => (req.user as { id?: string } | undefined)?.id ?? '';

@ApiTags('documents-experience')
@Controller({ path: 'documents', version: '1' })
export class DocumentsExperienceController {
  constructor(
    private readonly viewer: DocumentViewerService,
    private readonly compare: DocumentCompareService,
    private readonly insights: DocumentInsightsService,
    private readonly history: DocumentHistoryService,
    private readonly exports: DocumentExportService,
    private readonly comments: DocumentCommentsService,
    private readonly acks: DocumentAcknowledgementsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('insights') @Permissions('documents.read') @ApiOperation({ summary: 'Document insights / analytics' })
  getInsights(@Req() req: Request) { return this.insights.insights(req.dataScope); }

  @Get('advanced') @Permissions('documents.read') @ApiOperation({ summary: 'Advanced filtered document search' })
  async advanced(@Query() q: Record<string, string>, @Req() req: Request) {
    const where: Prisma.ControlledDocumentWhereInput = { deletedAt: null, ...departmentScopeWhere(req.dataScope) };
    if (q.search) where.OR = [{ title: { contains: q.search, mode: 'insensitive' } }, { code: { contains: q.search, mode: 'insensitive' } }];
    for (const [k, v] of Object.entries(q)) {
      if (!v || ['search', 'page', 'pageSize', 'sort'].includes(k)) continue;
      if (['departmentId', 'processId', 'categoryId', 'ownerId', 'approverId', 'reviewerId'].includes(k)) (where as Record<string, unknown>)[k] = v;
      if (k === 'status' || k === 'confidentiality') (where as Record<string, unknown>)[k] = v;
      if (k === 'revision') where.revision = Number(v);
      if (k === 'language' || k === 'code') (where as Record<string, unknown>)[k] = { contains: v, mode: 'insensitive' };
    }
    if (q.fileType) where.versions = { some: { mimeType: { contains: q.fileType } } };
    if (q.hasComments === 'true') where.comments = { some: {} };
    if (q.hasAcknowledgements === 'true') where.acknowledgements = { some: {} };
    if (q.effectiveFrom || q.effectiveTo) where.effectiveDate = { gte: q.effectiveFrom ?? undefined, lte: q.effectiveTo ?? undefined };
    const page = q.page ? Number(q.page) : 1;
    const pageSize = Math.min(q.pageSize ? Number(q.pageSize) : 20, 100);
    const [rows, total] = await Promise.all([
      this.prisma.controlledDocument.findMany({ where, skip: (page - 1) * pageSize, take: pageSize, orderBy: { updatedAt: 'desc' }, include: { department: { select: { name: true } } } }),
      this.prisma.controlledDocument.count({ where }),
    ]);
    return { items: rows.map((r) => ({ id: r.id, title: r.title, code: r.code, status: r.status, version: r.version, departmentName: r.department?.name ?? null, updatedAt: r.updatedAt.toISOString() })), total, page, pageSize };
  }

  @Get(':id/preview') @Permissions('documents.read') @ApiOperation({ summary: 'Enterprise document preview' })
  preview(@Param('id') id: string, @Req() req: Request, @Query('versionId') versionId?: string) {
    return this.viewer.preview(id, req.dataScope, actorFromRequest(req), versionId);
  }

  @Get(':id/history') @Permissions('documents.read') @ApiOperation({ summary: 'Document history timeline' })
  getHistory(@Param('id') id: string, @Req() req: Request) { return this.history.history(id, req.dataScope); }

  @Get(':id/compare') @Permissions('documents.read') @ApiOperation({ summary: 'Compare two versions' })
  compareVersions(@Param('id') id: string, @Query('a') a: string, @Query('b') b: string, @Req() req: Request) {
    return this.compare.compare(id, a, b, req.dataScope, actorFromRequest(req));
  }

  @Post(':id/track') @Permissions('documents.read') @ApiOperation({ summary: 'Record a viewer event (downloaded/printed/…)' })
  async track(@Param('id') id: string, @Body() body: { event: 'viewed' | 'downloaded' | 'printed' | 'compared' }, @Req() req: Request) {
    await this.exports.track(id, body.event, req.dataScope, actorFromRequest(req));
    return { ok: true };
  }

  @Get(':id/export/metadata') @Permissions('documents.read') @ApiOperation({ summary: 'Metadata JSON' })
  metadata(@Param('id') id: string, @Req() req: Request) { return this.exports.metadata(id, req.dataScope); }

  @Get(':id/export/versions') @Permissions('documents.read') @ApiOperation({ summary: 'Version history JSON' })
  versions(@Param('id') id: string, @Req() req: Request) { return this.exports.versionHistory(id, req.dataScope); }

  @Get(':id/export/relationships') @Permissions('documents.read') @ApiOperation({ summary: 'Relationship graph JSON' })
  relationships(@Param('id') id: string, @Req() req: Request) { return this.exports.relationshipGraph(id, req.dataScope); }

  @Get(':id/export/package') @Permissions('documents.read') @ApiOperation({ summary: 'Offline audit package (ZIP)' })
  async package(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    const { buffer, filename } = await this.exports.offlinePackage(id, req.dataScope, actorFromRequest(req));
    res.set('Content-Type', 'application/zip'); res.set('Content-Disposition', `attachment; filename="${filename}"`); res.send(buffer);
  }

  // ---- comments
  @Get(':id/comments') @Permissions('documents.read') @ApiOperation({ summary: 'Threaded comments' })
  listComments(@Param('id') id: string, @Req() req: Request) { return this.comments.list(id, req.dataScope); }

  @Post(':id/comments') @Permissions('documents.update') @ApiOperation({ summary: 'Add a comment' })
  addComment(@Param('id') id: string, @Body() dto: CreateCommentDto, @Req() req: Request) {
    return this.comments.create(id, dto.body, actorFromRequest(req), req.dataScope, dto.versionId, dto.parentId);
  }

  @Patch('comments/:commentId') @Permissions('documents.update') @ApiOperation({ summary: 'Edit a comment' })
  editComment(@Param('commentId') commentId: string, @Body() dto: UpdateCommentDto, @Req() req: Request) {
    return this.comments.edit(commentId, dto.body, actorFromRequest(req));
  }

  @Post('comments/:commentId/resolve') @Permissions('documents.update') @ApiOperation({ summary: 'Resolve / reopen a comment' })
  resolveComment(@Param('commentId') commentId: string, @Body() body: { resolved: boolean }, @Req() req: Request) {
    return this.comments.resolve(commentId, body.resolved ?? true, actorFromRequest(req));
  }

  @Delete('comments/:commentId') @Permissions('documents.update') @ApiOperation({ summary: 'Delete a comment' })
  async removeComment(@Param('commentId') commentId: string, @Req() req: Request) { await this.comments.remove(commentId, actorFromRequest(req)); return { ok: true }; }

  // ---- acknowledgements
  @Post(':id/acknowledge') @Permissions('documents.read') @ApiOperation({ summary: 'Acknowledge (mark as read) the current version' })
  acknowledge(@Param('id') id: string, @Req() req: Request) { return this.acks.acknowledge(id, actorFromRequest(req), req.dataScope); }

  @Get(':id/acknowledgements') @Permissions('documents.read') @ApiOperation({ summary: 'Who has / has not acknowledged' })
  ackStatus(@Param('id') id: string, @Req() req: Request) { return this.acks.status(id, req.dataScope); }
}

@ApiTags('bookmarks')
@Controller({ path: 'bookmarks', version: '1' })
export class DocumentBookmarksController {
  constructor(private readonly bookmarks: DocumentBookmarksService) {}
  @Get() list(@Req() req: Request) { return this.bookmarks.list(uid(req)); }
  @Post() add(@Body() dto: CreateBookmarkDto, @Req() req: Request) { return this.bookmarks.add(uid(req), dto); }
  @Delete(':id') async remove(@Param('id') id: string, @Req() req: Request) { await this.bookmarks.remove(uid(req), id); return { ok: true }; }
}
