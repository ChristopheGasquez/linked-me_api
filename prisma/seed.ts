import 'dotenv/config';  // Charge .env AVANT tout le reste
import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { Permissions } from '../src/auth/permissions.constants.js';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter });

async function main() {
  // 1. Créer les permissions (source unique : permissions.constants.ts)
  const permissions = Object.values(Permissions);

  for (const name of permissions) {
    await prisma.permission.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // 2. Créer les rôles
  const userRole = await prisma.role.upsert({
    where: { name: 'USER' },
    update: {},
    create: { name: 'USER' },
  });

  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: { name: 'ADMIN' },
  });

  // 3. Associer les permissions aux rôles
  const userPermissions = [
    Permissions.REALM_USER,
    Permissions.USER_READ,
    Permissions.USER_UPDATE_OWN,
    Permissions.USER_DELETE_OWN,
  ];
  const adminPermissions = permissions; // Admin a toutes les permissions

  for (const permName of userPermissions) {
    const perm = await prisma.permission.findUnique({ where: { name: permName } });
    if (perm) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: userRole.id, permissionId: perm.id } },
        update: {},
        create: { roleId: userRole.id, permissionId: perm.id },
      });
    }
  }

  for (const permName of adminPermissions) {
    const perm = await prisma.permission.findUnique({ where: { name: permName } });
    if (perm) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id } },
        update: {},
        create: { roleId: adminRole.id, permissionId: perm.id },
      });
    }
  }

  // 4. Créer un utilisateur admin initial (seulement s'il n'existe pas déjà)
  const bcrypt = await import('bcrypt');
  const adminEmail = process.env.ADMIN_EMAIL as string;
  const adminPassword = process.env.ADMIN_PASSWORD as string;

  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { password: hashedPassword, isEmailChecked: true },
    create: {
      email: adminEmail,
      password: hashedPassword,
      name: 'Admin',
      isEmailChecked: true,
      roles: {
        create: {
          role: { connect: { name: 'ADMIN' } },
        },
      },
    },
  });

  console.log(`Utilisateur admin upsert (${adminEmail})`);

  console.log('Seed terminé : rôles, permissions et admin créés');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
