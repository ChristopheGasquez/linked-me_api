import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../../audit/audit.service.js';
import { paginate } from '../../common/pagination/index.js';
import { FindRolesQueryDto } from './dto/find-roles-query.dto.js';
import { FindPermissionsQueryDto } from './dto/find-permissions-query.dto.js';

@Injectable()
export class AdminRolesService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async findAllRoles(query: FindRolesQueryDto) {
    const result = await paginate(this.prisma.role, query, {
      searchFields: ['name'],
      include: { permissions: { include: { permission: true } } },
    });
    return {
      ...result,
      data: result.data.map((role: any) => ({
        ...role,
        permissions: role.permissions.map((rp: any) => rp.permission),
      })),
    };
  }

  async findRoleById(roleId: number) {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: { permissions: { include: { permission: true } } },
    });
    if (!role) throw new NotFoundException('Role not found');
    return {
      ...role,
      permissions: role.permissions.map((rp) => rp.permission),
    };
  }

  async createRole(actorId: number, name: string) {
    const existing = await this.prisma.role.findUnique({ where: { name } });
    if (existing) {
      throw new BadRequestException(`Role "${name}" already exists`);
    }
    const role = await this.prisma.role.create({ data: { name } });
    await this.auditService.log('role.create', actorId, role.id, 'role', {
      name,
    });
    return role;
  }

  async deleteRole(actorId: number, roleId: number) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Role not found');

    const usersCount = await this.prisma.userRole.count({ where: { roleId } });
    if (usersCount > 0) {
      throw new BadRequestException(
        `Cannot delete: role is still assigned to ${usersCount} user(s)`,
      );
    }

    await this.prisma.role.delete({ where: { id: roleId } });
    await this.auditService.log('role.delete', actorId, roleId, 'role', {
      name: role.name,
    });
    return { message: `Role "${role.name}" deleted` };
  }

  async addPermissionsToRole(
    actorId: number,
    roleId: number,
    permissionNames: string[],
  ) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Role not found');

    const permissions = await this.prisma.permission.findMany({
      where: { name: { in: permissionNames } },
    });

    const foundNames = permissions.map((p) => p.name);
    const unknown = permissionNames.filter((n) => !foundNames.includes(n));
    if (unknown.length > 0) {
      throw new BadRequestException(
        `Unknown permissions: ${unknown.join(', ')}`,
      );
    }

    for (const perm of permissions) {
      await this.prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId: perm.id } },
        update: {},
        create: { roleId, permissionId: perm.id },
      });
    }

    await this.auditService.log(
      'role.permission.assign',
      actorId,
      roleId,
      'role',
      { roleName: role.name, permissions: permissionNames },
    );

    const updated = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: { permissions: { include: { permission: true } } },
    });
    return {
      ...updated!,
      permissions: updated!.permissions.map((rp) => rp.permission),
    };
  }

  async removePermissionFromRole(
    actorId: number,
    roleId: number,
    permissionId: number,
  ) {
    const link = await this.prisma.rolePermission.findUnique({
      where: { roleId_permissionId: { roleId, permissionId } },
      include: { role: true, permission: true },
    });
    if (!link) {
      throw new NotFoundException('Permission not assigned to this role');
    }

    await this.prisma.rolePermission.delete({
      where: { roleId_permissionId: { roleId, permissionId } },
    });
    await this.auditService.log(
      'role.permission.revoke',
      actorId,
      roleId,
      'role',
      { roleName: link.role.name, permissionName: link.permission.name },
    );
    return { message: 'Permission removed from role' };
  }

  async findAllPermissions(query: FindPermissionsQueryDto) {
    return paginate(this.prisma.permission, query, {
      searchFields: ['name'],
    });
  }
}
