import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { normalizeName } from '@tecpap/config';
import type { AuditTemplateDetailDto, AuditTemplateDto, PaginatedResult } from '@tecpap/types';
import type { Prisma } from '@prisma/client';
import type { ActorContext } from '../../common/context/actor';
import { paginated, parsePagination, parseSort } from '../../common/pagination/pagination';
import { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateTemplateDto,
  ListTemplatesQuery,
  UpdateTemplateDto,
} from './dto/audit-templates.dto';

const DETAIL_INCLUDE = {
  sections: { include: { questions: { orderBy: { order: 'asc' } } }, orderBy: { order: 'asc' } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  department: { select: { name: true } },
  process: { select: { name: true } },
} satisfies Prisma.AuditTemplateInclude;

const LIST_INCLUDE = {
  _count: { select: { sections: true, audits: true } },
  sections: { select: { _count: { select: { questions: true } } } },
  createdBy: { select: { firstName: true, lastName: true } },
  department: { select: { name: true } },
  process: { select: { name: true } },
} satisfies Prisma.AuditTemplateInclude;

@Injectable()
export class AuditTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly timeline: ActivityTimelineService,
  ) {}

  async list(query: ListTemplatesQuery): Promise<PaginatedResult<AuditTemplateDto>> {
    const { skip, take, page, pageSize, search } = parsePagination(query);
    const where: Prisma.AuditTemplateWhereInput = {
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.auditTemplate.findMany({
        where,
        skip,
        take,
        orderBy: parseSort(undefined, ['name', 'createdAt'], { updatedAt: 'desc' }),
        include: LIST_INCLUDE,
      }),
      this.prisma.auditTemplate.count({ where }),
    ]);
    return paginated(
      rows.map((row) => this.toListDto(row)),
      total,
      page,
      pageSize,
    );
  }

  async findOne(id: string): Promise<AuditTemplateDetailDto> {
    const template = await this.prisma.auditTemplate.findUnique({
      where: { id },
      include: DETAIL_INCLUDE,
    });
    if (!template) throw new NotFoundException('Template not found');
    return this.toDetailDto(template);
  }

  async create(dto: CreateTemplateDto, actor: ActorContext): Promise<AuditTemplateDetailDto> {
    await this.assertUniqueName(dto.name);
    const template = await this.prisma.$transaction(async (tx) => {
      const created = await tx.auditTemplate.create({
        data: {
          name: dto.name,
          normalizedName: normalizeName(dto.name),
          description: dto.description ?? null,
          category: dto.category,
          version: 1,
          status: 'DRAFT',
          departmentId: dto.departmentId ?? null,
          processId: dto.processId ?? null,
          createdById: actor.actorId ?? '',
        },
      });
      let sectionOrder = 0;
      for (const section of dto.sections) {
        const createdSection = await tx.auditTemplateSection.create({
          data: {
            templateId: created.id,
            title: section.title,
            order: section.order ?? sectionOrder,
            description: section.description ?? null,
          },
        });
        let questionOrder = 0;
        for (const question of section.questions ?? []) {
          await tx.auditTemplateQuestion.create({
            data: {
              sectionId: createdSection.id,
              text: question.text,
              type: question.type,
              required: question.required ?? false,
              weight: question.weight ?? 1,
              order: question.order ?? questionOrder,
              description: question.description ?? null,
              helpText: question.helpText ?? null,
              defaultAnswer: (question.defaultAnswer as Prisma.InputJsonValue) ?? undefined,
              evidenceRequired: question.evidenceRequired ?? false,
              findingRequired: question.findingRequired ?? false,
              options: question.options ?? [],
            },
          });
          questionOrder += 1;
        }
        sectionOrder += 1;
      }
      return tx.auditTemplate.findUnique({ where: { id: created.id }, include: DETAIL_INCLUDE });
    });
    if (!template) throw new NotFoundException('Template not found');
    await this.record('template.created', `Template "${template.name}" created`, template, actor);
    await this.audit(actor, 'template.create', template.id, { name: template.name });
    return this.toDetailDto(template);
  }

  async update(
    id: string,
    dto: UpdateTemplateDto,
    actor: ActorContext,
  ): Promise<AuditTemplateDetailDto> {
    const current = await this.prisma.auditTemplate.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Template not found');
    if (current.status === 'PUBLISHED')
      throw new ConflictException(
        'Published templates cannot be edited — clone to a new version instead',
      );
    if (dto.name !== undefined) await this.assertUniqueName(dto.name, id);

    await this.prisma.$transaction(async (tx) => {
      await tx.auditTemplate.update({
        where: { id },
        data: {
          ...(dto.name !== undefined
            ? { name: dto.name, normalizedName: normalizeName(dto.name) }
            : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.category !== undefined ? { category: dto.category } : {}),
          ...(dto.departmentId !== undefined ? { departmentId: dto.departmentId } : {}),
          ...(dto.processId !== undefined ? { processId: dto.processId } : {}),
          updatedById: actor.actorId,
        },
      });
      if (dto.sections) {
        await tx.auditTemplateSection.deleteMany({ where: { templateId: id } });
        let sectionOrder = 0;
        for (const section of dto.sections) {
          const createdSection = await tx.auditTemplateSection.create({
            data: {
              templateId: id,
              title: section.title,
              order: section.order ?? sectionOrder,
              description: section.description ?? null,
            },
          });
          let questionOrder = 0;
          for (const question of section.questions ?? []) {
            await tx.auditTemplateQuestion.create({
              data: {
                sectionId: createdSection.id,
                text: question.text,
                type: question.type,
                required: question.required ?? false,
                weight: question.weight ?? 1,
                order: question.order ?? questionOrder,
                description: question.description ?? null,
                helpText: question.helpText ?? null,
                defaultAnswer: (question.defaultAnswer as Prisma.InputJsonValue) ?? undefined,
                evidenceRequired: question.evidenceRequired ?? false,
                findingRequired: question.findingRequired ?? false,
                options: question.options ?? [],
              },
            });
            questionOrder += 1;
          }
          sectionOrder += 1;
        }
      }
    });

    const updated = await this.prisma.auditTemplate.findUnique({
      where: { id },
      include: DETAIL_INCLUDE,
    });
    await this.record(
      'template.updated',
      `Template "${updated?.name ?? id}" updated`,
      updated,
      actor,
    );
    await this.audit(actor, 'template.update', id);
    return this.toDetailDto(updated!);
  }

  async publish(id: string, actor: ActorContext): Promise<AuditTemplateDetailDto> {
    const template = await this.prisma.auditTemplate.update({
      where: { id },
      data: { status: 'PUBLISHED', updatedById: actor.actorId },
      include: DETAIL_INCLUDE,
    });
    await this.record(
      'template.published',
      `Template "${template.name}" published`,
      template,
      actor,
    );
    await this.audit(actor, 'template.publish', id);
    return this.toDetailDto(template);
  }

  async archive(id: string, actor: ActorContext): Promise<AuditTemplateDetailDto> {
    const template = await this.prisma.auditTemplate.update({
      where: { id },
      data: { status: 'ARCHIVED', updatedById: actor.actorId },
      include: DETAIL_INCLUDE,
    });
    await this.audit(actor, 'template.archive', id);
    return this.toDetailDto(template);
  }

  async clone(id: string, actor: ActorContext): Promise<AuditTemplateDetailDto> {
    const source = await this.prisma.auditTemplate.findUnique({
      where: { id },
      include: DETAIL_INCLUDE,
    });
    if (!source) throw new NotFoundException('Template not found');
    const cloneName = await this.uniqueCloneName(source.name);
    const clone = await this.prisma.$transaction(async (tx) => {
      const created = await tx.auditTemplate.create({
        data: {
          name: cloneName,
          normalizedName: normalizeName(cloneName),
          description: source.description,
          category: source.category,
          version: 1,
          status: 'DRAFT',
          departmentId: source.departmentId,
          processId: source.processId,
          createdById: actor.actorId ?? '',
        },
      });
      for (const section of source.sections) {
        const createdSection = await tx.auditTemplateSection.create({
          data: {
            templateId: created.id,
            title: section.title,
            order: section.order,
            description: section.description,
          },
        });
        for (const question of section.questions) {
          await tx.auditTemplateQuestion.create({
            data: {
              sectionId: createdSection.id,
              text: question.text,
              type: question.type,
              required: question.required,
              weight: question.weight,
              order: question.order,
              description: question.description,
              helpText: question.helpText,
              defaultAnswer: question.defaultAnswer as Prisma.InputJsonValue,
              evidenceRequired: question.evidenceRequired,
              findingRequired: question.findingRequired,
              options: question.options,
            },
          });
        }
      }
      return tx.auditTemplate.findUnique({ where: { id: created.id }, include: DETAIL_INCLUDE });
    });
    await this.record('template.cloned', `Template cloned from "${source.name}"`, clone, actor);
    await this.audit(actor, 'template.clone', clone!.id, { sourceId: id });
    return this.toDetailDto(clone!);
  }

  async remove(id: string, actor: ActorContext): Promise<void> {
    const template = await this.prisma.auditTemplate.findUnique({
      where: { id },
      include: { _count: { select: { audits: true } } },
    });
    if (!template) throw new NotFoundException('Template not found');
    if (template._count.audits > 0)
      throw new ConflictException(
        'Cannot delete a template that has been used by audits — archive it instead',
      );
    await this.prisma.auditTemplate.delete({ where: { id } });
    await this.audit(actor, 'template.delete', id);
  }

  /** Rejects a name already used by another template (case-insensitive, whitespace-normalized). */
  private async assertUniqueName(name: string, excludeId?: string): Promise<void> {
    const existing = await this.prisma.auditTemplate.findFirst({
      where: {
        normalizedName: normalizeName(name),
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (existing)
      throw new ConflictException({
        code: 'TEMPLATE_DUPLICATE_NAME',
        message: 'A template with this name already exists.',
      });
  }

  /** "X (copy)", then "X (copy 2)", "X (copy 3)"... so repeated cloning never collides with Part 4's new uniqueness rule. */
  private async uniqueCloneName(sourceName: string): Promise<string> {
    let candidate = `${sourceName} (copy)`;
    let attempt = 2;
    while (
      await this.prisma.auditTemplate.findFirst({
        where: { normalizedName: normalizeName(candidate) },
        select: { id: true },
      })
    ) {
      candidate = `${sourceName} (copy ${attempt})`;
      attempt += 1;
    }
    return candidate;
  }

  // ----------------------------------------------------------------- mappings

  private baseDto(template: {
    id: string;
    name: string;
    description: string | null;
    category: string;
    version: number;
    status: string;
    departmentId: string | null;
    processId: string | null;
    createdById: string;
    createdAt: Date;
    updatedAt: Date;
    department: { name: string } | null;
    process: { name: string } | null;
    createdBy: { firstName: string; lastName: string } | null;
  }) {
    return {
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      version: template.version,
      status: template.status as AuditTemplateDto['status'],
      departmentId: template.departmentId,
      departmentName: template.department?.name ?? null,
      processId: template.processId,
      processName: template.process?.name ?? null,
      createdById: template.createdById,
      createdByName: template.createdBy
        ? `${template.createdBy.firstName} ${template.createdBy.lastName}`
        : null,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
    };
  }

  private toListDto(template: {
    id: string;
    name: string;
    description: string | null;
    category: string;
    version: number;
    status: string;
    departmentId: string | null;
    processId: string | null;
    createdById: string;
    createdAt: Date;
    updatedAt: Date;
    department: { name: string } | null;
    process: { name: string } | null;
    createdBy: { firstName: string; lastName: string } | null;
    _count: { sections: number; audits: number };
    sections: { _count: { questions: number } }[];
  }): AuditTemplateDto {
    return {
      ...this.baseDto(template),
      sectionCount: template._count.sections,
      questionCount: template.sections.reduce((sum, section) => sum + section._count.questions, 0),
    };
  }

  private toDetailDto(template: {
    id: string;
    name: string;
    description: string | null;
    category: string;
    version: number;
    status: string;
    departmentId: string | null;
    processId: string | null;
    createdById: string;
    createdAt: Date;
    updatedAt: Date;
    department: { name: string } | null;
    process: { name: string } | null;
    createdBy: { firstName: string; lastName: string } | null;
    sections: {
      id: string;
      templateId: string;
      title: string;
      order: number;
      description: string | null;
      questions: {
        id: string;
        sectionId: string;
        text: string;
        type: string;
        required: boolean;
        weight: number;
        order: number;
        description: string | null;
        helpText: string | null;
        defaultAnswer: unknown;
        evidenceRequired: boolean;
        findingRequired: boolean;
        options: string[];
      }[];
    }[];
  }): AuditTemplateDetailDto {
    return {
      ...this.baseDto(template),
      sectionCount: template.sections.length,
      questionCount: template.sections.reduce((sum, section) => sum + section.questions.length, 0),
      sections: template.sections.map((section) => ({
        id: section.id,
        templateId: section.templateId,
        title: section.title,
        order: section.order,
        description: section.description,
        questions: section.questions.map((question) => ({
          id: question.id,
          sectionId: question.sectionId,
          text: question.text,
          type: question.type as AuditTemplateDetailDto['sections'][number]['questions'][number]['type'],
          required: question.required,
          weight: question.weight,
          order: question.order,
          description: question.description,
          helpText: question.helpText,
          defaultAnswer: question.defaultAnswer,
          evidenceRequired: question.evidenceRequired,
          findingRequired: question.findingRequired,
          options: question.options,
        })),
      })),
    };
  }

  private async record(
    eventType: string,
    title: string,
    template: { id: string; processId: string | null } | null,
    actor: ActorContext,
  ): Promise<void> {
    if (!template) return;
    await this.timeline.record({
      processId: template.processId,
      eventType,
      title,
      entityType: 'template',
      entityId: template.id,
      actorId: actor.actorId,
    });
  }

  private async audit(
    actor: ActorContext,
    action: string,
    entityId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.auditLog.record({
      actorId: actor.actorId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      action,
      entityType: 'template',
      entityId,
      metadata: metadata ?? null,
    });
  }
}
