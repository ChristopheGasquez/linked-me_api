import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../../audit/audit.service.js';
import { UserCacheService } from '../../auth/cache/user-cache.service.js';
import {
  paginate,
  PaginatedResponse,
} from '../../../common/pagination/index.js';
import type { Prisma } from '../../../../generated/prisma/client.js';
import { FindUsersQueryDto } from './dto/find-users-query.dto.js';
import { FindSessionsQueryDto } from '../../auth/dto/find-sessions-query.dto.js';
import { ResponseCodes } from '../../../common/constants/response-codes.js';

@Injectable()
export class AdminUsersService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private userCache: UserCacheService,
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

    const result = (await paginate(this.prisma.user, query, {
      searchFields: ['email', 'name'],
      where,
      include: { roles: { include: { role: true } } },
      metaFilters,
    })) as PaginatedResponse<
      Prisma.UserGetPayload<{ include: { roles: { include: { role: true } } } }>
    >;

    return {
      ...result,
      data: result.data.map(({ password: _password, ...user }) => ({
        ...user,
        roles: user.roles.map((ur) => ur.role),
      })),
    };
  }

  async findUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });
    if (!user)
      throw new NotFoundException({
        message: 'User not found',
        code: ResponseCodes.ADMIN_USER_NOT_FOUND,
      });
    const { password: _password, ...rest } = user;
    return { ...rest, roles: rest.roles.map((ur) => ur.role) };
  }

  async addRoleToUser(actorId: string, userId: string, roleName: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user)
      throw new NotFoundException({
        message: 'User not found',
        code: ResponseCodes.ADMIN_USER_NOT_FOUND,
      });

    const role = await this.prisma.role.findUnique({
      where: { name: roleName },
    });
    if (!role)
      throw new NotFoundException({
        message: 'Role not found',
        code: ResponseCodes.ADMIN_ROLE_NOT_FOUND,
        params: { roleName },
      });

    const existing = await this.prisma.userRole.findUnique({
      where: { userId_roleId: { userId, roleId: role.id } },
    });
    if (existing) {
      throw new BadRequestException({
        message: 'User already has this role',
        code: ResponseCodes.ADMIN_USER_ROLE_ALREADY_ASSIGNED,
        params: { roleName },
      });
    }

    await this.prisma.userRole.create({ data: { userId, roleId: role.id } });
    await this.auditService.log('user.role.assign', actorId, userId, 'user', {
      roleName,
    });
    this.userCache.invalidate(userId);
    return {
      message: 'Role assigned to user',
      code: ResponseCodes.ADMIN_USER_ROLE_ASSIGNED,
      params: { roleName, userId },
    };
  }

  async removeRoleFromUser(actorId: string, userId: string, roleId: string) {
    const link = await this.prisma.userRole.findUnique({
      where: { userId_roleId: { userId, roleId } },
      include: { role: true },
    });
    if (!link) {
      throw new NotFoundException({
        message: 'Role not assigned to this user',
        code: ResponseCodes.ADMIN_USER_ROLE_NOT_ASSIGNED,
      });
    }

    await this.prisma.userRole.delete({
      where: { userId_roleId: { userId, roleId } },
    });
    await this.auditService.log('user.role.revoke', actorId, userId, 'user', {
      roleName: link.role.name,
    });
    this.userCache.invalidate(userId);
    return {
      message: 'Role removed from user',
      code: ResponseCodes.ADMIN_USER_ROLE_REMOVED,
    };
  }

  async deleteUser(actorId: string, userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: true },
    });
    if (!user)
      throw new NotFoundException({
        message: 'User not found',
        code: ResponseCodes.ADMIN_USER_NOT_FOUND,
      });

    if (user.roles.length > 0) {
      throw new BadRequestException({
        message: 'Cannot delete: remove all roles from this user first',
        code: ResponseCodes.ADMIN_USER_HAS_ROLES,
      });
    }

    await this.prisma.user.delete({ where: { id: userId } });
    await this.auditService.log('user.delete', actorId, userId, 'user', {
      email: user.email,
      name: user.name,
    });
    this.userCache.invalidate(userId);
    return {
      message: 'User deleted',
      code: ResponseCodes.ADMIN_USER_DELETED,
      params: { userId },
    };
  }

  async findUserSessions(userId: string, query: FindSessionsQueryDto) {
    await this.assertUserExists(userId);
    const result = await paginate(this.prisma.refreshToken, query, {
      where: { userId, expiresAt: { gt: new Date() } },
    });
    return {
      ...result,
      data: result.data.map(({ token: _token, ...session }) => session),
    };
  }

  async revokeUserSession(actorId: string, userId: string, sessionId: string) {
    const session = await this.prisma.refreshToken.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session)
      throw new NotFoundException({
        message: 'Session not found',
        code: ResponseCodes.ADMIN_USER_SESSION_NOT_FOUND,
      });

    await this.prisma.refreshToken.delete({ where: { id: sessionId } });
    await this.auditService.log(
      'user.session.revoke',
      actorId,
      userId,
      'user',
      { sessionId },
    );
    return {
      message: 'Session revoked',
      code: ResponseCodes.ADMIN_USER_SESSION_REVOKED,
      params: { userId, sessionId },
    };
  }

  async revokeAllUserSessions(actorId: string, userId: string) {
    await this.assertUserExists(userId);
    // Expired tokens are deleted too, but only active sessions are counted:
    // expired ones are already considered gone (the cleanup cron removes them).
    const [count] = await this.prisma.$transaction([
      this.prisma.refreshToken.count({
        where: { userId, expiresAt: { gt: new Date() } },
      }),
      this.prisma.refreshToken.deleteMany({ where: { userId } }),
    ]);
    await this.auditService.log(
      'user.session.revoke_all',
      actorId,
      userId,
      'user',
      { count },
    );
    return {
      message: 'All sessions revoked',
      code: ResponseCodes.ADMIN_USER_SESSIONS_REVOKED,
      params: { userId, count },
    };
  }

  private async assertUserExists(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user)
      throw new NotFoundException({
        message: 'User not found',
        code: ResponseCodes.ADMIN_USER_NOT_FOUND,
      });
  }
}
