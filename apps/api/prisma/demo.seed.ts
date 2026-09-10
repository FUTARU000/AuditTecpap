/* eslint-disable no-console */
/**
 * DEMO seed — DEVELOPMENT / DEMONSTRATION ONLY.
 *
 * Creates sample users and sample business entities so the platform can be
 * explored locally. This MUST NEVER run in production: the orchestrator
 * (seed.ts) only invokes it when NODE_ENV !== 'production' and the demo flag is
 * not disabled. Real TECPAP data is entered through import, user creation and
 * daily operation — not through this file.
 */
import type { PrismaClient } from '@prisma/client';
import { SYSTEM_ROLE_SLUGS } from '@tecpap/config';
import { hashPassword } from '../src/modules/auth/utils/password';

export async function seedDemo(prisma: PrismaClient): Promise<void> {
  console.info('[demo] Seeding demonstration users…');
  const findRole = (slug: string) => prisma.role.findUnique({ where: { slug } });
  // Development accounts only: one per system role. Production creates real
  // users through the Users admin (the bootstrap admin already exists from the
  // system seed; here we just set a known dev password + add manager/pilot).
  const DEMO_USERS = [
    { email: 'admin@tecpap.local', password: 'Admin123!', firstName: 'Platform', lastName: 'Administrator', roleSlug: SYSTEM_ROLE_SLUGS.ADMIN, deptCode: null },
    { email: 'audit.manager@tecpap.local', password: 'Audit123!', firstName: 'Audit', lastName: 'Manager', roleSlug: SYSTEM_ROLE_SLUGS.AUDIT_MANAGER, deptCode: null },
    { email: 'pilot.production@tecpap.local', password: 'Pilot123!', firstName: 'Production', lastName: 'Pilot', roleSlug: SYSTEM_ROLE_SLUGS.PILOT, deptCode: 'PROD' },
  ];
  for (const u of DEMO_USERS) {
    const [dept, role] = await Promise.all([u.deptCode ? prisma.department.findUnique({ where: { code: u.deptCode } }) : Promise.resolve(null), findRole(u.roleSlug)]);
    if (!role) continue;
    const passwordHash = await hashPassword(u.password);
    await prisma.user.upsert({
      where: { email: u.email },
      update: { passwordHash, firstName: u.firstName, lastName: u.lastName, roleId: role.id, departmentId: dept?.id ?? null, status: 'ACTIVE' },
      create: { email: u.email, firstName: u.firstName, lastName: u.lastName, passwordHash, roleId: role.id, departmentId: dept?.id ?? null, status: 'ACTIVE' },
    });
  }

  console.info('[demo] Seeding demonstration audit template…');
  const prodDept = await prisma.department.findUnique({ where: { code: 'PROD' } });
  const adminUser = await prisma.user.findUnique({ where: { email: 'admin@tecpap.local' } });

  if (prodDept && adminUser && !(await prisma.auditTemplate.findFirst({ where: { name: 'Production Line Audit' } }))) {
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

  console.info('[demo] Demonstration seed complete.');
}
