import type { Permission } from '../../src/core/auth/permissions.constants.js';
import type { TestApp } from './app.factory.js';
import { createVerifiedUser, type AuthTokens } from './auth.helper.js';

let roleCounter = 0;

/**
 * Creates a verified user whose ONLY role is a dedicated test role holding
 * exactly `permissions` (the default USER role from registration is removed).
 * The role is deleted by cleanDatabase().
 */
export async function createUserWithPermissions(
  t: TestApp,
  permissions: readonly Permission[],
): Promise<AuthTokens & { email: string }> {
  const user = await createVerifiedUser(t);

  const perms = await t.prisma.permission.findMany({
    where: { name: { in: [...permissions] } },
  });
  if (perms.length !== permissions.length) {
    throw new Error(`Unknown permission in [${permissions.join(', ')}]`);
  }

  const role = await t.prisma.role.create({
    data: {
      name: `test-role-${Date.now()}-${++roleCounter}`,
      permissions: {
        create: perms.map((p) => ({ permissionId: p.id })),
      },
    },
  });

  await t.prisma.$transaction([
    t.prisma.userRole.deleteMany({ where: { userId: user.userId } }),
    t.prisma.userRole.create({
      data: { userId: user.userId, roleId: role.id },
    }),
  ]);

  // The JWT strategy loads permissions from the database on the first
  // authenticated request (then caches them), so the existing tokens are valid.
  return user;
}
