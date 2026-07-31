/* eslint-disable no-console */
/**
 * Seed: the permission catalog, the three system roles (with default permission
 * sets), the nine departments, and a default Administrator.
 *
 * Run via `pnpm db:seed` (configured as `prisma db seed` → tsx prisma/seed.ts).
 * Idempotent — safe to re-run.
 */
import { PrismaClient } from '@prisma/client';
import { BUSINESS_OBJECT_TYPES, DEPARTMENTS, DOCUMENT_CATEGORIES, PERMISSION_CATALOG, SYSTEM_ROLE_SLUGS, SYSTEM_ROLES } from '@tecpap/config';
import { hashPassword } from '../src/modules/auth/utils/password';

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@tecpap.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';

async function main(): Promise<void> {
  console.info('Seeding permission catalog…');
  const permissionIds: Record<string, string> = {};
  for (const group of PERMISSION_CATALOG) {
    for (const permission of group.permissions) {
      const record = await prisma.permission.upsert({
        where: { key: permission.key },
        update: {
          group: group.group,
          label: permission.label,
          description: permission.description ?? null,
        },
        create: {
          key: permission.key,
          group: group.group,
          label: permission.label,
          description: permission.description ?? null,
        },
      });
      permissionIds[permission.key] = record.id;
    }
  }

  console.info('Seeding system roles…');
  const roleIds: Record<string, string> = {};
  for (const role of SYSTEM_ROLES) {
    const created = await prisma.role.upsert({
      where: { slug: role.slug },
      update: {
        name: role.name,
        description: role.description,
        isSystem: true,
        isGlobal: role.isGlobal,
      },
      create: {
        name: role.name,
        slug: role.slug,
        description: role.description,
        isSystem: true,
        isGlobal: role.isGlobal,
      },
    });
    await prisma.role.update({
      where: { id: created.id },
      data: {
        permissions: {
          set: role.permissions.map((key) => ({ id: permissionIds[key] })),
        },
      },
    });
    roleIds[role.slug] = created.id;
  }

  console.info('Seeding departments…');
  for (const department of DEPARTMENTS) {
    await prisma.department.upsert({
      where: { code: department.code },
      update: {
        name: department.name,
        description: department.description,
        sortOrder: department.sortOrder,
      },
      create: {
        code: department.code,
        name: department.name,
        description: department.description,
        sortOrder: department.sortOrder,
      },
    });
  }

  console.info('Seeding document categories…');
  for (const category of DOCUMENT_CATEGORIES) {
    await prisma.documentCategory.upsert({
      where: { code: category.code },
      update: {
        name: category.name,
        icon: category.icon,
        color: category.color,
        description: category.description,
        sortOrder: category.sortOrder,
      },
      create: {
        code: category.code,
        name: category.name,
        icon: category.icon,
        color: category.color,
        description: category.description,
        sortOrder: category.sortOrder,
      },
    });
  }

  console.info('Seeding business object types…');
  for (const type of BUSINESS_OBJECT_TYPES) {
    await prisma.businessObjectType.upsert({
      where: { code: type.code },
      update: { name: type.name, icon: type.icon, color: type.color, description: type.description, sortOrder: type.sortOrder },
      create: { code: type.code, name: type.name, icon: type.icon, color: type.color, description: type.description, sortOrder: type.sortOrder },
    });
  }

  console.info('Seeding default Administrator…');
  const passwordHash = await hashPassword(ADMIN_PASSWORD);
  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { passwordHash, roleId: roleIds[SYSTEM_ROLE_SLUGS.ADMIN]! },
    create: {
      email: ADMIN_EMAIL,
      firstName: 'Platform',
      lastName: 'Administrator',
      passwordHash,
      roleId: roleIds[SYSTEM_ROLE_SLUGS.ADMIN]!,
    },
  });

  // ---------------------------------------------------------- production users
  console.info('Seeding production users…');
  const SEED_USERS = [
    { email: 'admin@tecpap.ma', password: 'Admin123!', firstName: 'System', lastName: 'Administrator', roleSlug: SYSTEM_ROLE_SLUGS.ADMIN, deptCode: null },
    { email: 'audit.manager@tecpap.ma', password: 'Audit123!', firstName: 'Audit', lastName: 'Manager', roleSlug: SYSTEM_ROLE_SLUGS.AUDIT_MANAGER, deptCode: null },
    { email: 'pilot.production@tecpap.ma', password: 'Pilot123!', firstName: 'Production', lastName: 'Pilot', roleSlug: SYSTEM_ROLE_SLUGS.PILOT, deptCode: 'PROD' },
    { email: 'pilot.quality@tecpap.ma', password: 'Pilot123!', firstName: 'Quality', lastName: 'Pilot', roleSlug: SYSTEM_ROLE_SLUGS.PILOT, deptCode: 'QUAL' },
    { email: 'pilot.maintenance@tecpap.ma', password: 'Pilot123!', firstName: 'Maintenance', lastName: 'Pilot', roleSlug: SYSTEM_ROLE_SLUGS.PILOT, deptCode: 'MAINT' },
  ];
  for (const seedUser of SEED_USERS) {
    const dept = seedUser.deptCode ? await prisma.department.findUnique({ where: { code: seedUser.deptCode } }) : null;
    const hash = await hashPassword(seedUser.password);
    await prisma.user.upsert({
      where: { email: seedUser.email },
      update: { passwordHash: hash, firstName: seedUser.firstName, lastName: seedUser.lastName, roleId: roleIds[seedUser.roleSlug]!, departmentId: dept?.id ?? null, status: 'ACTIVE' },
      create: { email: seedUser.email, firstName: seedUser.firstName, lastName: seedUser.lastName, passwordHash: hash, roleId: roleIds[seedUser.roleSlug]!, departmentId: dept?.id ?? null, status: 'ACTIVE' },
    });
  }

  // ---------------------------------------------------------- demo data
  console.info('Seeding demo data…');
  const prodDept = await prisma.department.findUnique({ where: { code: 'PROD' } });
  const qualDept = await prisma.department.findUnique({ where: { code: 'QUAL' } });
  const maintDept = await prisma.department.findUnique({ where: { code: 'MAINT' } });
  const adminUser = await prisma.user.findUnique({ where: { email: 'admin@tecpap.ma' } });

  // Demo processes
  if (prodDept) {
    await prisma.process.upsert({
      where: { departmentId_code: { departmentId: prodDept.id, code: 'BLOW' } },
      update: {},
      create: { departmentId: prodDept.id, code: 'BLOW', name: 'Bottle Blowing', objectives: 'Produce PET bottles at target weight and quality', scope: 'Blow molding lines 1-3', status: 'ACTIVE' },
    });
    await prisma.process.upsert({
      where: { departmentId_code: { departmentId: prodDept.id, code: 'FILL' } },
      update: {},
      create: { departmentId: prodDept.id, code: 'FILL', name: 'Filling & Capping', objectives: 'Fill and cap bottles at target speed and accuracy', scope: 'Filling lines 4-5', status: 'ACTIVE' },
    });
  }
  if (qualDept) {
    await prisma.process.upsert({
      where: { departmentId_code: { departmentId: qualDept.id, code: 'QC' } },
      update: {},
      create: { departmentId: qualDept.id, code: 'QC', name: 'Quality Control', objectives: 'Ensure product quality meets specifications', scope: 'Laboratory and line inspections', status: 'ACTIVE' },
    });
  }
  if (maintDept) {
    await prisma.process.upsert({
      where: { departmentId_code: { departmentId: maintDept.id, code: 'PM' } },
      update: {},
      create: { departmentId: maintDept.id, code: 'PM', name: 'Preventive Maintenance', objectives: 'Minimize unplanned downtime through planned maintenance', scope: 'All production equipment', status: 'ACTIVE' },
    });
  }

  // Demo KPIs
  if (prodDept) {
    const blow = await prisma.process.findUnique({ where: { departmentId_code: { departmentId: prodDept.id, code: 'BLOW' } } });
    if (blow) {
      const existing = await prisma.kpi.findFirst({ where: { processId: blow.id, name: 'Bottle Weight Accuracy' } });
      if (!existing) await prisma.kpi.create({ data: { name: 'Bottle Weight Accuracy', processId: blow.id, departmentId: prodDept.id, target: 99, unit: '%', currentValue: 98.5, frequency: 'DAILY', status: 'ACTIVE' } });
    }
    const fill = await prisma.process.findUnique({ where: { departmentId_code: { departmentId: prodDept.id, code: 'FILL' } } });
    if (fill) {
      const existing = await prisma.kpi.findFirst({ where: { processId: fill.id, name: 'Line Efficiency' } });
      if (!existing) await prisma.kpi.create({ data: { name: 'Line Efficiency', processId: fill.id, departmentId: prodDept.id, target: 85, unit: '%', currentValue: 82, frequency: 'WEEKLY', status: 'ACTIVE' } });
    }
  }
  if (qualDept) {
    const qc = await prisma.process.findUnique({ where: { departmentId_code: { departmentId: qualDept.id, code: 'QC' } } });
    if (qc) {
      const existing = await prisma.kpi.findFirst({ where: { processId: qc.id, name: 'First Pass Yield' } });
      if (!existing) await prisma.kpi.create({ data: { name: 'First Pass Yield', processId: qc.id, departmentId: qualDept.id, target: 97, unit: '%', currentValue: 95.2, frequency: 'MONTHLY', status: 'ACTIVE' } });
    }
  }

  // Demo risks
  if (prodDept) {
    const blow = await prisma.process.findUnique({ where: { departmentId_code: { departmentId: prodDept.id, code: 'BLOW' } } });
    if (blow) {
      const existing = await prisma.processRisk.findFirst({ where: { processId: blow.id, title: 'Preform contamination' } });
      if (!existing) await prisma.processRisk.create({ data: { processId: blow.id, title: 'Preform contamination', description: 'Risk of contamination from improper storage', probability: 2, impact: 4, riskScore: 8, mitigation: 'Implement sealed storage and regular inspections', status: 'OPEN' } });
    }
    const fill = await prisma.process.findUnique({ where: { departmentId_code: { departmentId: prodDept.id, code: 'FILL' } } });
    if (fill) {
      const existing = await prisma.processRisk.findFirst({ where: { processId: fill.id, title: 'Capping torque deviation' } });
      if (!existing) await prisma.processRisk.create({ data: { processId: fill.id, title: 'Capping torque deviation', probability: 3, impact: 3, riskScore: 9, mitigation: 'Daily torque checks and calibration', status: 'OPEN' } });
    }
  }

  // Demo audit template (published)
  if (prodDept && adminUser) {
    const existingTpl = await prisma.auditTemplate.findFirst({ where: { name: 'Production Line Audit' } });
    if (!existingTpl) {
      const tpl = await prisma.auditTemplate.create({ data: { name: 'Production Line Audit', description: 'Routine production line audit checklist', category: 'Process Audit', version: 1, status: 'PUBLISHED', departmentId: prodDept.id, createdById: adminUser.id } });
      const s1 = await prisma.auditTemplateSection.create({ data: { templateId: tpl.id, title: 'Line Clearance', order: 0 } });
      await prisma.auditTemplateQuestion.create({ data: { sectionId: s1.id, text: 'Is the production area clean and organized?', type: 'YES_NO', required: true, order: 0, weight: 1 } });
      await prisma.auditTemplateQuestion.create({ data: { sectionId: s1.id, text: 'Are batch records present and complete?', type: 'YES_NO_NA', required: true, order: 1, weight: 1 } });
      await prisma.auditTemplateQuestion.create({ data: { sectionId: s1.id, text: 'Are previous batch materials removed?', type: 'YES_NO', order: 2, weight: 1 } });
      const s2 = await prisma.auditTemplateSection.create({ data: { templateId: tpl.id, title: 'Equipment & Safety', order: 1 } });
      await prisma.auditTemplateQuestion.create({ data: { sectionId: s2.id, text: 'Is equipment calibration current?', type: 'YES_NO', required: true, order: 0, weight: 1 } });
      await prisma.auditTemplateQuestion.create({ data: { sectionId: s2.id, text: 'Are safety guards in place?', type: 'YES_NO', required: true, order: 1, weight: 1, findingRequired: true } });
      await prisma.auditTemplateQuestion.create({ data: { sectionId: s2.id, text: 'Any visible leaks or defects?', type: 'YES_NO', order: 2, weight: 1, evidenceRequired: true } });
    }
  }

  console.info('Seed complete.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
