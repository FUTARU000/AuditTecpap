import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MAX_UPLOAD_BYTES } from '@tecpap/config';
import { actorFromRequest } from '../../common/context/actor';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CapaActionsService } from './capa-actions.service';
import { CapaFindingsService } from './capa-findings.service';
import { CapaReportsService } from './capa-reports.service';
import { CapaService } from './capa.service';
import { ClosureDto, CreateActionDto, CreateCapaDto, CreateWhyStepDto, EffectivenessDto, FindingDecisionDto, ListCapasQuery, TransitionDto, UpdateActionDto, UpdateCapaDto, UpdateEightDDto, UpdateRootCauseDto, VerificationDto } from './dto/capa.dto';

@ApiTags('capas')
@Controller({ path: 'capas', version: '1' })
export class CapaController {
  constructor(
    private readonly capaService: CapaService,
    private readonly actionsService: CapaActionsService,
    private readonly reportsService: CapaReportsService,
    private readonly findingsService: CapaFindingsService,
  ) {}

  @Get() @Permissions('capas.read') @ApiOperation({ summary: 'List CAPAs (scoped)' })
  list(@Query() query: ListCapasQuery, @Req() req: Request) { return this.capaService.list(query, req.dataScope); }

  @Get(':id') @Permissions('capas.read') @ApiOperation({ summary: 'CAPA detail' })
  findOne(@Param('id') id: string, @Req() req: Request) { return this.capaService.findOne(id, req.dataScope); }

  @Post() @Permissions('capas.create') @ApiOperation({ summary: 'Create a CAPA' })
  create(@Body() dto: CreateCapaDto, @Req() req: Request) { return this.capaService.create(dto, actorFromRequest(req)); }

  @Patch(':id') @Permissions('capas.update') @ApiOperation({ summary: 'Update a CAPA' })
  update(@Param('id') id: string, @Body() dto: UpdateCapaDto, @Req() req: Request) { return this.capaService.update(id, dto, actorFromRequest(req)); }

  @Post(':id/transition') @Permissions('capas.update') @ApiOperation({ summary: 'Transition CAPA status' })
  transition(@Param('id') id: string, @Body() dto: TransitionDto, @Req() req: Request) { return this.capaService.transition(id, dto.status, actorFromRequest(req)); }

  @Post(':id/verify') @Permissions('capas.verify') @ApiOperation({ summary: 'Verify CAPA' })
  verify(@Param('id') id: string, @Body() dto: VerificationDto, @Req() req: Request) { return this.capaService.verify(id, dto.result, dto.notes ?? null, actorFromRequest(req)); }

  @Post(':id/effectiveness') @Permissions('capas.effectiveness_review') @ApiOperation({ summary: 'Effectiveness review' })
  effectiveness(@Param('id') id: string, @Body() dto: EffectivenessDto, @Req() req: Request) { return this.capaService.reviewEffectiveness(id, dto.result, dto.notes ?? null, actorFromRequest(req)); }

  @Post(':id/close') @Permissions('capas.close') @ApiOperation({ summary: 'Close CAPA' })
  close(@Param('id') id: string, @Body() dto: ClosureDto, @Req() req: Request) { return this.capaService.close(id, dto.closureComment ?? null, actorFromRequest(req)); }

  @Delete(':id') @Permissions('capas.update') @ApiOperation({ summary: 'Soft-delete CAPA' })
  remove(@Param('id') id: string, @Req() req: Request) { return this.capaService.remove(id, actorFromRequest(req)); }

  // Root Cause
  @Patch(':id/root-cause') @Permissions('capas.update') @ApiOperation({ summary: 'Update root cause analysis' })
  updateRootCause(@Param('id') id: string, @Body() dto: UpdateRootCauseDto, @Req() req: Request) { return this.capaService.updateRootCause(id, dto, actorFromRequest(req)); }

  @Post(':id/why-steps') @Permissions('capas.update') @ApiOperation({ summary: 'Add a 5-Why step' })
  addWhyStep(@Param('id') id: string, @Body() dto: CreateWhyStepDto, @Req() req: Request) { return this.capaService.addWhyStep(id, dto.question, dto.answer ?? null, actorFromRequest(req)); }

  @Delete(':id/why-steps/:stepId') @Permissions('capas.update') @ApiOperation({ summary: 'Delete a 5-Why step' })
  deleteWhyStep(@Param('id') id: string, @Param('stepId') stepId: string) { return this.capaService.deleteWhyStep(id, stepId); }

  @Patch(':id/eight-d') @Permissions('capas.update') @ApiOperation({ summary: 'Update 8D worksheet' })
  updateEightD(@Param('id') id: string, @Body() dto: UpdateEightDDto, @Req() req: Request) { return this.capaService.updateEightD(id, dto as Record<string, string | null>, actorFromRequest(req)); }

  // Actions
  @Get(':id/actions') @Permissions('capa_actions.read') @ApiOperation({ summary: 'List actions' })
  listActions(@Param('id') id: string) { return this.actionsService.list(id); }

  @Post(':id/actions') @Permissions('capa_actions.create') @ApiOperation({ summary: 'Create action' })
  createAction(@Param('id') id: string, @Body() dto: CreateActionDto, @Req() req: Request) { return this.actionsService.create(id, dto, actorFromRequest(req)); }

  @Patch(':id/actions/:actionId') @Permissions('capa_actions.update') @ApiOperation({ summary: 'Update action' })
  updateAction(@Param('id') id: string, @Param('actionId') actionId: string, @Body() dto: UpdateActionDto, @Req() req: Request) { return this.actionsService.update(actionId, dto, actorFromRequest(req)); }

  @Delete(':id/actions/:actionId') @Permissions('capa_actions.create') @ApiOperation({ summary: 'Delete action' })
  removeAction(@Param('id') id: string, @Param('actionId') actionId: string) { return this.actionsService.remove(actionId); }

  @Post(':id/actions/:actionId/evidence') @Permissions('capa_actions.update') @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } })) @ApiOperation({ summary: 'Upload action evidence' })
  uploadEvidence(@Param('id') id: string, @Param('actionId') actionId: string, @UploadedFile() file: Express.Multer.File, @Body() body: { comment?: string }, @Req() req: Request) {
    if (!file) return Promise.reject(new Error('File is required'));
    return this.actionsService.uploadEvidence(actionId, file, body.comment ?? null, actorFromRequest(req));
  }

  @Get(':id/actions/:actionId/evidence/:evidenceId/download') @Permissions('capa_actions.read') @ApiOperation({ summary: 'Download evidence' })
  downloadEvidence(@Param('actionId') actionId: string, @Param('evidenceId') evidenceId: string) { return this.actionsService.downloadUrl(actionId, evidenceId); }

  // Reports
  @Get(':id/report.pdf') @Permissions('capas.export') @ApiOperation({ summary: 'PDF report' })
  async reportPdf(@Param('id') id: string, @Res() res: Response) {
    const buffer = await this.reportsService.generatePdf(id);
    res.set('Content-Type', 'application/pdf'); res.set('Content-Disposition', `attachment; filename="${id}.pdf"`); res.send(buffer);
  }

  @Get(':id/report.xlsx') @Permissions('capas.export') @ApiOperation({ summary: 'Excel report' })
  async reportXlsx(@Param('id') id: string, @Res() res: Response) {
    const buffer = await this.reportsService.generateExcel(id);
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); res.set('Content-Disposition', `attachment; filename="${id}.xlsx"`); res.send(buffer);
  }
}

@ApiTags('finding-capa')
@Controller({ path: 'findings', version: '1' })
export class FindingCapaController {
  constructor(private readonly findingsService: CapaFindingsService) {}

  @Post(':id/capa-decision') @Permissions('capas.create') @ApiOperation({ summary: 'Record CAPA decision on a finding' })
  decide(@Param('id') id: string, @Body() dto: FindingDecisionDto, @Req() req: Request) { return this.findingsService.decide(id, dto, actorFromRequest(req)); }

  @Post(':id/capa') @Permissions('capas.create') @ApiOperation({ summary: 'Create CAPA from finding' })
  createFromFinding(@Param('id') id: string, @Body() dto: CreateCapaDto, @Req() req: Request) { return this.findingsService.createFromFinding(id, dto, actorFromRequest(req)); }
}
