import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class AdminRolesService {
  constructor(private prisma: PrismaService) {}

  async findAllRoles() {
    const roles = await this.prisma.role.findMany({
      include: { permissions: { include: { permission: true } } },
    });
    return roles.map((role) => ({
      ...role,
      permissions: role.permissions.map((rp) => rp.permission),
    }));
  }

  async findRoleById(roleId: number) {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: { permissions: { include: { permission: true } } },
    });
    if (!role) throw new NotFoundException('Rôle non trouvé');
    return { ...role, permissions: role.permissions.map((rp) => rp.permission) };
  }

  async createRole(name: string) {
    const existing = await this.prisma.role.findUnique({ where: { name } });
    if (existing) {
      throw new BadRequestException(`Le rôle "${name}" existe déjà`);
    }
    return this.prisma.role.create({ data: { name } });
  }

  async deleteRole(roleId: number) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Rôle non trouvé');

    const usersCount = await this.prisma.userRole.count({ where: { roleId } });
    if (usersCount > 0) {
      throw new BadRequestException(
        `Impossible de supprimer : ce rôle est encore assigné à ${usersCount} utilisateur(s)`,
      );
    }

    await this.prisma.role.delete({ where: { id: roleId } });
    return { message: `Rôle "${role.name}" supprimé` };
  }

  async addPermissionsToRole(roleId: number, permissionNames: string[]) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Rôle non trouvé');

    const permissions = await this.prisma.permission.findMany({
      where: { name: { in: permissionNames } },
    });

    const foundNames = permissions.map((p) => p.name);
    const unknown = permissionNames.filter((n) => !foundNames.includes(n));
    if (unknown.length > 0) {
      throw new BadRequestException(`Permissions inconnues : ${unknown.join(', ')}`);
    }

    for (const perm of permissions) {
      await this.prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId: perm.id } },
        update: {},
        create: { roleId, permissionId: perm.id },
      });
    }

    const updated = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: { permissions: { include: { permission: true } } },
    });
    return { ...updated!, permissions: updated!.permissions.map((rp) => rp.permission) };
  }

  async removePermissionFromRole(roleId: number, permissionId: number) {
    const link = await this.prisma.rolePermission.findUnique({
      where: { roleId_permissionId: { roleId, permissionId } },
    });
    if (!link) {
      throw new NotFoundException("Cette permission n'est pas assignée à ce rôle");
    }

    await this.prisma.rolePermission.delete({
      where: { roleId_permissionId: { roleId, permissionId } },
    });
    return { message: 'Permission retirée du rôle' };
  }

  async findAllPermissions() {
    return this.prisma.permission.findMany();
  }
}
