/* eslint-disable no-console */
/**
 * Seed: the permission catalog, the three system roles (with default permission
 * sets), the nine departments, and a default Administrator.
 *
 * Run via `pnpm db:seed` (configured as `prisma db seed` → tsx prisma/seed.ts).
 * Idempotent — safe to re-run.
 */
import { PrismaClient } from '@prisma/client';
import { DEPARTMENTS, PERMISSION_CATALOG, SYSTEM_ROLE_SLUGS, SYSTEM_ROLES } from '@tecpap/config';
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
