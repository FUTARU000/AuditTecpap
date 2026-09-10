/* eslint-disable no-console */
/**
 * SYSTEM seed — the data the application itself needs to function.
 * Safe, idempotent, and the ONLY seed that runs in production:
 *   • permission catalog   • the three system roles (+ permission sets)
 *   • the nine TECPAP departments   • document categories
 *   • business-object types   • one bootstrap Administrator
 *
 * No business entities (documents, processes, audits, CAPAs, …) are created
 * here — production is populated only through import, user creation and daily
 * operation. See demo.seed.ts for development-only demonstration data.
 */
import type { PrismaClient } from '@prisma/client';
import { BUSINESS_OBJECT_TYPES, DEPARTMENTS, DOCUMENT_CATEGORIES, PERMISSION_CATALOG, SYSTEM_ROLE_SLUGS, SYSTEM_ROLES } from '@tecpap/config';
import { hashPassword } from '../src/modules/auth/utils/password';

export async function seedSystem(prisma: PrismaClient): Promise<void> {
  console.info('[system] Seeding permission catalog…');
  const permissionIds: Record<string, string> = {};
  for (const group of PERMISSION_CATALOG) {
    for (const permission of group.permissions) {
      const record = await prisma.permission.upsert({
        where: { key: permission.key },
        update: { group: group.group, label: permission.label, description: permission.description ?? null },
        create: { key: permission.key, group: group.group, label: permission.label, description: permission.description ?? null },
      });
      permissionIds[permission.key] = record.id;
    }
  }

  console.info('[system] Seeding system roles…');
  for (const role of SYSTEM_ROLES) {
    const created = await prisma.role.upsert({
      where: { slug: role.slug },
      update: { name: role.name, description: role.description, isSystem: true, isGlobal: role.isGlobal },
      create: { name: role.name, slug: role.slug, description: role.description, isSystem: true, isGlobal: role.isGlobal },
    });
    await prisma.role.update({
      where: { id: created.id },
      data: { permissions: { set: role.permissions.map((key) => ({ id: permissionIds[key] })) } },
    });
  }

  console.info('[system] Seeding departments…');
  for (const department of DEPARTMENTS) {
    await prisma.department.upsert({
      where: { code: department.code },
      update: { name: department.name, description: department.description, sortOrder: department.sortOrder },
      create: { code: department.code, name: department.name, description: department.description, sortOrder: department.sortOrder },
    });
  }

  console.info('[system] Seeding document categories…');
  for (const category of DOCUMENT_CATEGORIES) {
    await prisma.documentCategory.upsert({
      where: { code: category.code },
      update: { name: category.name, icon: category.icon, color: category.color, description: category.description, sortOrder: category.sortOrder },
      create: { code: category.code, name: category.name, icon: category.icon, color: category.color, description: category.description, sortOrder: category.sortOrder },
    });
  }

  console.info('[system] Seeding business object types…');
  for (const type of BUSINESS_OBJECT_TYPES) {
    await prisma.businessObjectType.upsert({
      where: { code: type.code },
      update: { name: type.name, icon: type.icon, color: type.color, description: type.description, sortOrder: type.sortOrder },
      create: { code: type.code, name: type.name, icon: type.icon, color: type.color, description: type.description, sortOrder: type.sortOrder },
    });
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@tecpap.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
  const adminRoleId = (await prisma.role.findUnique({ where: { slug: SYSTEM_ROLE_SLUGS.ADMIN } }))?.id;
  if (adminRoleId) {
    console.info(`[system] Seeding bootstrap Administrator (${adminEmail})…`);
    const passwordHash = await hashPassword(adminPassword);
    await prisma.user.upsert({
      where: { email: adminEmail },
      // Only set the password on first create — never clobber an existing
      // password on restart (the admin may have changed it; dev seeds set
      // their own password without being overwritten by the system seed).
      update: { roleId: adminRoleId, status: 'ACTIVE' },
      create: { email: adminEmail, firstName: 'Platform', lastName: 'Administrator', passwordHash, roleId: adminRoleId, status: 'ACTIVE' },
    });
  }

  console.info('[system] System seed complete.');
}
