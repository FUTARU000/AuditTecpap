import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MAX_UPLOAD_BYTES } from '@tecpap/config';
import { actorFromRequest } from '../../common/context/actor';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CapaFindingsService } from '../capa/capa-findings.service';
import { AuditEvidenceService } from './audit-evidence.service';
import { AuditReportsService } from './audit-reports.service';
import { AuditsService } from './audits.service';
import { FindingsService } from './findings.service';
import { AnswerQuestionDto, CreateAuditDto, ListAuditsQuery, ReviewDto } from './dto/audits.dto';
import { CreateFindingDto, UpdateFindingDto } from './dto/findings.dto';

@ApiTags('audits')
@Controller({ path: 'audits', version: '1' })
export class AuditsController {
  constructor(
    private readonly auditsService: AuditsService,
    private readonly findingsService: FindingsService,
    private readonly evidenceService: AuditEvidenceService,
    private readonly reportsService: AuditReportsService,
    private readonly capaFindingsService: CapaFindingsService,
  ) {}

  @Get()
  @Permissions('audits.read')
  @ApiOperation({ summary: 'List audits (scoped)' })
  list(@Query() query: ListAuditsQuery, @Req() req: Request) { return this.auditsService.list(query, req.dataScope); }

  @Get(':id')
  @Permissions('audits.read')
  @ApiOperation({ summary: 'Audit detail (template + answers + findings + evidence)' })
  findOne(@Param('id') id: string, @Req() req: Request) { return this.auditsService.findOne(id, req.dataScope); }

  @Post()
  @Permissions('audits.create')
  @ApiOperation({ summary: 'Create an audit from a published template' })
  create(@Body() dto: CreateAuditDto, @Req() req: Request) { return this.auditsService.create(dto, actorFromRequest(req)); }

  @Post(':id/start')
  @Permissions('audits.execute')
  @ApiOperation({ summary: 'Start / resume execution' })
  start(@Param('id') id: string, @Req() req: Request) { return this.auditsService.start(id, actorFromRequest(req)); }

  @Patch(':id/answer')
  @Permissions('audits.execute')
  @ApiOperation({ summary: 'Answer a question (autosaves)' })
  answer(@Param('id') id: string, @Body() dto: AnswerQuestionDto, @Req() req: Request) { return this.auditsService.answer(id, dto, actorFromRequest(req)); }

  @Post(':id/submit')
  @Permissions('audits.submit')
  @ApiOperation({ summary: 'Submit audit for review' })
  submit(@Param('id') id: string, @Req() req: Request) { return this.auditsService.submit(id, actorFromRequest(req)); }

  @Post(':id/approve')
  @Permissions('audits.approve')
  @ApiOperation({ summary: 'Approve the audit' })
  approve(@Param('id') id: string, @Body() dto: ReviewDto, @Req() req: Request) { return this.auditsService.approve(id, dto, actorFromRequest(req)); }

  @Post(':id/return')
  @Permissions('audits.approve')
  @ApiOperation({ summary: 'Return the audit for corrections' })
  returnAudit(@Param('id') id: string, @Body() dto: ReviewDto, @Req() req: Request) { return this.auditsService.returnAudit(id, dto, actorFromRequest(req)); }

  @Post(':id/complete')
  @Permissions('audits.approve')
  @ApiOperation({ summary: 'Mark the approved audit completed' })
  complete(@Param('id') id: string, @Req() req: Request) { return this.auditsService.complete(id, actorFromRequest(req)); }

  @Delete(':id')
  @Permissions('audits.create')
  @ApiOperation({ summary: 'Delete an audit' })
  remove(@Param('id') id: string, @Req() req: Request) { return this.auditsService.remove(id, actorFromRequest(req)); }

  // --------------------------------------------------------------- findings

  @Get(':id/findings')
  @Permissions('findings.read')
  listFindings(@Param('id') id: string, @Req() req: Request) { return this.findingsService.listByAudit(id, req.dataScope); }

  @Post(':id/findings')
  @Permissions('findings.create')
  async createFinding(@Param('id') id: string, @Body() dto: CreateFindingDto, @Req() req: Request) {
    const actor = actorFromRequest(req);
    const finding = await this.findingsService.create({ ...dto, auditId: id }, actor, req.dataScope);
    // Phase 7.7: auto-create CAPA for non-conformity findings (TECPAP workflow)
    void this.capaFindingsService.autoCreateForFinding(finding.id, actor).catch(() => undefined);
    return finding;
  }

  @Patch(':auditId/findings/:findingId')
  @Permissions('findings.update')
  updateFinding(@Param('findingId') findingId: string, @Body() dto: UpdateFindingDto, @Req() req: Request) {
    return this.findingsService.update(findingId, dto, actorFromRequest(req), req.dataScope);
  }

  @Delete(':auditId/findings/:findingId')
  @Permissions('findings.update')
  removeFinding(@Param('findingId') findingId: string, @Req() req: Request) { return this.findingsService.remove(findingId, req.dataScope); }

  // --------------------------------------------------------------- evidence

  @Get(':id/evidence')
  @Permissions('audits.read')
  listEvidence(@Param('id') id: string, @Req() req: Request) { return this.evidenceService.listByAudit(id, req.dataScope); }

  @Post(':id/evidence')
  @Permissions('evidence.upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  @ApiOperation({ summary: 'Upload evidence (multipart: file + questionId?/findingId?/comment?)' })
  uploadEvidence(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() meta: { questionId?: string; findingId?: string; comment?: string },
    @Req() req: Request,
  ) {
    if (!file) return Promise.reject(new Error('File is required'));
    return this.evidenceService.upload(id, file, meta, actorFromRequest(req), req.dataScope);
  }

  @Get(':auditId/evidence/:evidenceId/download')
  @Permissions('audits.read')
  downloadEvidence(@Param('evidenceId') evidenceId: string, @Req() req: Request) { return this.evidenceService.downloadUrl(evidenceId, req.dataScope); }

  @Delete(':id/evidence/:evidenceId')
  @Permissions('evidence.upload')
  @ApiOperation({ summary: 'Delete evidence' })
  async deleteEvidence(@Param('id') id: string, @Param('evidenceId') evidenceId: string, @Req() req: Request) {
    await this.evidenceService.remove(evidenceId, actorFromRequest(req), req.dataScope);
    return { ok: true };
  }

  // --------------------------------------------------------------- reports

  @Get(':id/report.pdf')
  @Permissions('reports.export')
  @ApiOperation({ summary: 'Download the PDF report' })
  async reportPdf(@Param('id') id: string, @Res() res: Response) {
    const buffer = await this.reportsService.generatePdf(id);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="audit-${id}.pdf"`);
    res.send(buffer);
  }

  @Get(':id/report.xlsx')
  @Permissions('reports.export')
  @ApiOperation({ summary: 'Download the Excel report' })
  async reportXlsx(@Param('id') id: string, @Res() res: Response) {
    const buffer = await this.reportsService.generateExcel(id);
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition', `attachment; filename="audit-${id}.xlsx"`);
    res.send(buffer);
  }
}
