import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { UsersService } from '../users/users.service.js';
import { paginate } from '../common/pagination/index.js';
import { FindUsersQueryDto } from './dto/find-users-query.dto.js';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
    private configService: ConfigService,
  ) {}

  // ─── Rôles ───────────────────────────────────────────────

  async findAllRoles() {
    const roles = await this.prisma.role.findMany({
      include: { permissions: { include: { permission: true } } },
    });
    return roles.map((role) => ({
      ...role,
      permissions: role.permissions.map((rp) => rp.permission),
    }));
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
    if (!role) {
      throw new NotFoundException('Rôle non trouvé');
    }

    const usersCount = await this.prisma.userRole.count({ where: { roleId } });
    if (usersCount > 0) {
      throw new BadRequestException(
        `Impossible de supprimer : ce rôle est encore assigné à ${usersCount} utilisateur(s)`,
      );
    }

    await this.prisma.role.delete({ where: { id: roleId } });
    return { message: `Rôle "${role.name}" supprimé` };
  }

  // ─── Permissions sur un rôle ─────────────────────────────

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

    // Upsert pour éviter les doublons
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
      throw new NotFoundException('Cette permission n\'est pas assignée à ce rôle');
    }

    await this.prisma.rolePermission.delete({
      where: { roleId_permissionId: { roleId, permissionId } },
    });
    return { message: 'Permission retirée du rôle' };
  }

  // ─── Permissions (consultation) ──────────────────────────

  async findAllPermissions() {
    return this.prisma.permission.findMany();
  }

  // ─── Utilisateurs & rôles ────────────────────────────────

  async findAllUsers(query: FindUsersQueryDto) {
    const where: Record<string, unknown> = {};
    const metaFilters: Record<string, unknown> = {};

    if (query.role) {
      where.roles = { some: { role: { name: query.role } } };
      metaFilters.role = query.role;
    }

    if (query.isEmailChecked !== undefined) {
      where.isEmailChecked = query.isEmailChecked;
      metaFilters.isEmailChecked = query.isEmailChecked;
    }

    const result = await paginate(this.prisma.user, query, {
      searchFields: ['email', 'name'],
      where,
      include: { roles: { include: { role: true } } },
      metaFilters,
    });

    return {
      ...result,
      data: result.data.map(({ password, ...user }: any) => ({
        ...user,
        roles: user.roles.map((ur: any) => ur.role),
      })),
    };
  }

  async findUserById(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });
    if (!user) throw new NotFoundException('Utilisateur non trouvé');
    const { password, ...rest } = user;
    return { ...rest, roles: rest.roles.map((ur) => ur.role) };
  }

  async addRoleToUser(userId: number, roleName: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur non trouvé');

    const role = await this.prisma.role.findUnique({ where: { name: roleName } });
    if (!role) throw new NotFoundException(`Rôle "${roleName}" non trouvé`);

    const existing = await this.prisma.userRole.findUnique({
      where: { userId_roleId: { userId, roleId: role.id } },
    });
    if (existing) {
      throw new BadRequestException(`L'utilisateur a déjà le rôle "${roleName}"`);
    }

    await this.prisma.userRole.create({ data: { userId, roleId: role.id } });
    return { message: `Rôle "${roleName}" assigné à l'utilisateur ${userId}` };
  }

  async removeRoleFromUser(userId: number, roleId: number) {
    const link = await this.prisma.userRole.findUnique({
      where: { userId_roleId: { userId, roleId } },
    });
    if (!link) {
      throw new NotFoundException('Ce rôle n\'est pas assigné à cet utilisateur');
    }

    await this.prisma.userRole.delete({
      where: { userId_roleId: { userId, roleId } },
    });
    return { message: 'Rôle retiré de l\'utilisateur' };
  }

  // ─── Suppression d'un utilisateur ─────────────────────────

  async deleteUser(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: true },
    });
    if (!user) throw new NotFoundException('Utilisateur non trouvé');

    if (user.roles.length > 0) {
      throw new BadRequestException(
        'Impossible de supprimer : retirez d\'abord tous les rôles de cet utilisateur',
      );
    }

    await this.prisma.user.delete({ where: { id: userId } });
    return { message: `Utilisateur ${userId} supprimé` };
  }

  // ─── Nettoyage des comptes non vérifiés ─────────────────

  async cleanupUnverifiedUsers() {
    const ttl = +this.configService.getOrThrow<string>('UNVERIFIED_USER_TTL_HOURS');
    const count = await this.usersService.deleteUnverified(ttl);
    return { message: `${count} compte(s) non vérifié(s) supprimé(s)` };
  }
}
