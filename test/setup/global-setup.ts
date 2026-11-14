import { execSync } from 'node:child_process';
import { PrismaPg } from '@prisma/adapter-pg';
import type { TestProject } from 'vitest/node';
import { PrismaClient } from '../../generated/prisma/client.js';

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1'];

/**
 * Safety net: refuses any database that is not a local *_test database,
 * since this setup empties every table.
 */
function assertLocalTestDatabase(databaseUrl: string | undefined): void {
  const url = new URL(databaseUrl ?? 'postgresql://x/');
  const dbName = url.pathname.slice(1);
  const isLocalHost = LOCAL_HOSTS.includes(url.hostname);

  if (!dbName.endsWith('_test') || !isLocalHost) {
    throw new Error(
      `E2E tests refuse to run on "${url.hostname}/${dbName}": DATABASE_URL must point to a local *_test database (see test/README.md)`,
    );
  }
}

/** Empties every table (except Prisma's migration history) and resets ids. */
async function truncateAllTables(databaseUrl: string): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  try {
    const tables = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
    if (tables.length > 0) {
      const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
      await prisma.$executeRawUnsafe(
        `TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Runs once before all E2E suites: applies migrations, empties the
 * test database and seeds roles, permissions and admin.
 */
export default async function setup(project: TestProject) {
  const env = { ...process.env, ...project.config.env };
  assertLocalTestDatabase(env.DATABASE_URL);

  execSync('npx prisma migrate deploy', { env, stdio: 'inherit' });
  await truncateAllTables(env.DATABASE_URL as string);
  execSync('npx prisma db seed', { env, stdio: 'inherit' });
}
