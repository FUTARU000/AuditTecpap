import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { ProcessAssignmentDto } from '@tecpap/types';
import type { ActorContext } from '../../common/context/actor';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateAssignmentDto } from './dto/process-assignments.dto';

/** Responsibilities: Owner / Approver / Operator / Auditor / Manager per process. */
@Injectable()
export class ProcessAssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(processId: string): Promise<ProcessAssignmentDto[]> {
    const rows = await this.prisma.processAssignment.findMany({
      where: { processId },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    });
    return rows.map((row) => ({
      id: row.id, processId: row.processId, userId: row.userId, role: row.role,
      userName: row.user ? `${row.user.firstName} ${row.user.lastName}` : null,
      userEmail: row.user?.email ?? null,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async create(processId: string, dto: CreateAssignmentDto, actor: ActorContext): Promise<ProcessAssignmentDto> {
    const process = await this.prisma.process.findFirst({ where: { id: processId, deletedAt: null } });
    if (!process) throw new NotFoundException('Process not found');
    const user = await this.prisma.user.findFirst({ where: { id: dto.userId, deletedAt: null } });
    if (!user) throw new NotFoundException('User not found');

    const assignment = await this.prisma.processAssignment
      .create({ data: { processId, userId: dto.userId, role: dto.role }, include: { user: { select: { firstName: true, lastName: true, email: true } } } })
      .catch(() => { throw new ConflictException('This assignment already exists'); });

    await this.auditLog.record({ actorId: actor.actorId, ipAddress: actor.ipAddress, userAgent: actor.userAgent, action: 'process.assignment', entityType: 'process', entityId: processId, metadata: { userId: dto.userId, role: dto.role } });
    return { id: assignment.id, processId, userId: dto.userId, role: assignment.role, userName: assignment.user ? `${assignment.user.firstName} ${assignment.user.lastName}` : null, userEmail: assignment.user?.email ?? null, createdAt: assignment.createdAt.toISOString() };
  }

  async remove(assignmentId: string, actor: ActorContext): Promise<void> {
    const assignment = await this.prisma.processAssignment.findUnique({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException('Assignment not found');
    await this.prisma.processAssignment.delete({ where: { id: assignmentId } });
    await this.auditLog.record({ actorId: actor.actorId, ipAddress: actor.ipAddress, userAgent: actor.userAgent, action: 'process.assignment_removed', entityType: 'process', entityId: assignment.processId, metadata: { assignmentId } });
  }
}
