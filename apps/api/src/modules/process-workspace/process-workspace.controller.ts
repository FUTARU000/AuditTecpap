import { Body, Controller, Delete, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { actorFromRequest } from '../../common/context/actor';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import { CreateAssignmentDto } from './dto/process-assignments.dto';
import { ProcessAssignmentsService } from './process-assignments.service';
import { ProcessWorkspaceService } from './process-workspace.service';

@ApiTags('process-workspace')
@Controller({ path: 'processes', version: '1' })
export class ProcessWorkspaceController {
  constructor(
    private readonly workspaceService: ProcessWorkspaceService,
    private readonly assignmentsService: ProcessAssignmentsService,
    private readonly timelineService: ActivityTimelineService,
  ) {}

  @Get(':id/workspace')
  @Permissions('processes.read')
  @ApiOperation({ summary: 'Process workspace — aggregated home page' })
  workspace(@Param('id') id: string, @Req() req: Request) {
    return this.workspaceService.workspace(id, req.dataScope);
  }

  @Get(':id/timeline')
  @Permissions('processes.read')
  @ApiOperation({ summary: 'Process activity timeline' })
  timeline(@Param('id') id: string) {
    return this.timelineService.listByProcess(id);
  }

  @Get(':id/assignments')
  @Permissions('processes.read')
  @ApiOperation({ summary: 'Process responsibilities' })
  listAssignments(@Param('id') id: string) {
    return this.assignmentsService.list(id);
  }

  @Post(':id/assignments')
  @Permissions('processes.update')
  @ApiOperation({ summary: 'Assign a responsibility' })
  createAssignment(@Param('id') id: string, @Body() dto: CreateAssignmentDto, @Req() req: Request) {
    return this.assignmentsService.create(id, dto, actorFromRequest(req));
  }

  @Delete(':id/assignments/:assignmentId')
  @Permissions('processes.update')
  @ApiOperation({ summary: 'Remove a responsibility' })
  removeAssignment(@Param('assignmentId') assignmentId: string, @Req() req: Request) {
    return this.assignmentsService.remove(assignmentId, actorFromRequest(req));
  }
}
