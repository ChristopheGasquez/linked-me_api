import { PrismaService } from '../../src/core/prisma/prisma.service.js';

/**
 * Removes data created by tests, keeps seed data (roles, permissions, admin).
 * Convention: tests never modify the seeded USER/ADMIN roles, they create their own.
 */
export async function cleanDatabase(prisma: PrismaService): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL;
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    // cascades refresh tokens, email verifications, password resets, user roles
    prisma.user.deleteMany({ where: { email: { not: adminEmail } } }),
    // admin's own sessions and reset requests
    prisma.refreshToken.deleteMany(),
    prisma.passwordReset.deleteMany(),
    prisma.role.deleteMany({ where: { name: { notIn: ['USER', 'ADMIN'] } } }),
    prisma.user.update({
      where: { email: adminEmail },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    }),
  ]);
}
