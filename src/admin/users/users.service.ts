import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../../audit/audit.service.js';
import { paginate } from '../../common/pagination/index.js';
import { FindUsersQueryDto } from './dto/find-users-query.dto.js';

@Injectable()
export class AdminUsersService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

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
    if (!user) throw new NotFoundException('User not found');
    const { password, ...rest } = user;
    return { ...rest, roles: rest.roles.map((ur) => ur.role) };
  }

  async addRoleToUser(actorId: number, userId: number, roleName: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const role = await this.prisma.role.findUnique({ where: { name: roleName } });
    if (!role) throw new NotFoundException(`Role "${roleName}" not found`);

    const existing = await this.prisma.userRole.findUnique({
      where: { userId_roleId: { userId, roleId: role.id } },
    });
    if (existing) {
      throw new BadRequestException(`User already has role "${roleName}"`);
    }

    await this.prisma.userRole.create({ data: { userId, roleId: role.id } });
    await this.auditService.log('user.role.assign', actorId, userId, 'user', { roleName });
    return { message: `Role "${roleName}" assigned to user ${userId}` };
  }

  async removeRoleFromUser(actorId: number, userId: number, roleId: number) {
    const link = await this.prisma.userRole.findUnique({
      where: { userId_roleId: { userId, roleId } },
      include: { role: true },
    });
    if (!link) {
      throw new NotFoundException('Role not assigned to this user');
    }

    await this.prisma.userRole.delete({
      where: { userId_roleId: { userId, roleId } },
    });
    await this.auditService.log('user.role.revoke', actorId, userId, 'user', { roleName: link.role.name });
    return { message: 'Role removed from user' };
  }

  async deleteUser(actorId: number, userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: true },
    });
    if (!user) throw new NotFoundException('User not found');

    if (user.roles.length > 0) {
      throw new BadRequestException(
        'Cannot delete: remove all roles from this user first',
      );
    }

    await this.prisma.user.delete({ where: { id: userId } });
    await this.auditService.log('user.delete', actorId, userId, 'user', { email: user.email, name: user.name });
    return { message: `User ${userId} deleted` };
  }
}
