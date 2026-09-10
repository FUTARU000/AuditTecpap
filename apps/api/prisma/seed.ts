/* eslint-disable no-console */
/**
 * Seed orchestrator.
 *
 *   • system.seed.ts  → always runs (permissions, roles, departments, categories,
 *                       business-object types, one bootstrap Administrator).
 *   • demo.seed.ts    → runs ONLY outside production (sample users + sample
 *                       business data) so a real deployment starts clean.
 *
 * Production (NODE_ENV=production) therefore seeds configuration only; the
 * first business data entered is TECPAP's own, via import / user creation /
 * daily operation. Force demo off in dev with SEED_INCLUDE_DEMO=false.
 */
import { PrismaClient } from '@prisma/client';
import { seedSystem } from './system.seed';
import { seedDemo } from './demo.seed';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  await seedSystem(prisma);

  const includeDemo = process.env.NODE_ENV !== 'production' && process.env.SEED_INCLUDE_DEMO !== 'false';
  if (includeDemo) {
    await seedDemo(prisma);
  } else {
    console.info('[seed] Production mode (NODE_ENV=production) — demonstration data skipped. Platform starts clean.');
  }
}

main()
  .then(() => console.info('Seed complete.'))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
