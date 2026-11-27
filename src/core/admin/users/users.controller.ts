import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AdminUsersService } from './users.service.js';
import { AssignRoleDto } from './dto/assign-role.dto.js';
import { FindUsersQueryDto } from './dto/find-users-query.dto.js';
import { UserAdminResponseDto } from './dto/user-admin-response.dto.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../auth/guards/permissions.guard.js';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator.js';
import { Permissions } from '../../auth/permissions.constants.js';
import { ErrorResponseDto } from '../../../common/dto/error-response.dto.js';
import {
  UserRoleAssignedResponseDto,
  UserRoleRemovedResponseDto,
  UserDeletedResponseDto,
  UserSessionRevokedResponseDto,
  UserSessionsRevokedResponseDto,
} from './dto/user-success.dto.js';
import { FindSessionsQueryDto } from '../../auth/dto/find-sessions-query.dto.js';
import { SessionResponseDto } from '../../auth/dto/session-response.dto.js';
import { ValidationErrorResponseDto } from '../../../common/dto/validation-error-response.dto.js';
import {
  RoleNotFoundErrorDto,
  UserRoleAlreadyAssignedErrorDto,
} from './dto/user-error.dto.js';
import { ApiPaginatedResponse } from '../../../common/pagination/index.js';
import {
  ApiAuthErrors,
  ApiInvalidIdError,
  ApiOriginError,
  ApiThrottleError,
  ApiValidationError,
} from '../../../common/swagger/api-common-responses.decorator.js';
import { AdminOriginOnly } from '../../../common/origins/admin-origin-only.decorator.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import type { CachedUser } from '../../auth/cache/user-cache.service.js';

@ApiTags('Admin / Users')
@ApiAuthErrors()
@ApiThrottleError()
@ApiOriginError()
@AdminOriginOnly()
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(Permissions.REALM_ADMIN)
@Controller('admin')
export class AdminUsersController {
  constructor(private usersService: AdminUsersService) {}

  @ApiOperation({ summary: 'List users with pagination, sorting and filters' })
  @ApiPaginatedResponse(UserAdminResponseDto, 'Paginated list of users')
  @ApiValidationError(
    'Invalid query parameter (page, limit, sortBy, sortOrder or filter) — code: validation.failed',
  )
  @RequirePermissions(Permissions.ADMIN_USER_READ)
  @Get('users')
  findAllUsers(@Query() query: FindUsersQueryDto) {
    return this.usersService.findAllUsers(query);
  }

  @ApiOperation({ summary: 'Get a user by ID' })
  @ApiResponse({
    status: 200,
    type: UserAdminResponseDto,
    description: 'User found',
  })
  @ApiInvalidIdError()
  @ApiResponse({
    status: 404,
    description: 'User not found',
    type: ErrorResponseDto,
  })
  @RequirePermissions(Permissions.ADMIN_USER_READ)
  @Get('users/:id')
  findUserById(@Param('id', new ParseUUIDPipe({ version: '7' })) id: string) {
    return this.usersService.findUserById(id);
  }

  @ApiOperation({ summary: 'Assign a role to a user' })
  @ApiResponse({
    status: 201,
    type: UserRoleAssignedResponseDto,
    description: 'Role assigned',
  })
  @ApiResponse({
    status: 400,
    description:
      'User already has this role (admin.user.role_already_assigned, params.roleName), validation failed (validation.failed) or invalid ID (must be an integer)',
    type: UserRoleAlreadyAssignedErrorDto,
  })
  @ApiResponse({
    status: 404,
    description:
      'User not found (admin.user.not_found) or role not found (admin.role.not_found, params.roleName)',
    type: RoleNotFoundErrorDto,
  })
  @RequirePermissions(Permissions.ADMIN_USER_ASSIGN_ROLE)
  @Post('users/:id/roles')
  addRoleToUser(
    @CurrentUser() user: CachedUser,
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
    @Body() dto: AssignRoleDto,
  ) {
    return this.usersService.addRoleToUser(user.id, id, dto.role);
  }

  @ApiOperation({ summary: 'Remove a role from a user' })
  @ApiResponse({
    status: 200,
    type: UserRoleRemovedResponseDto,
    description: 'Role removed',
  })
  @ApiResponse({
    status: 404,
    description: 'Association not found',
    type: ErrorResponseDto,
  })
  @ApiInvalidIdError()
  @RequirePermissions(Permissions.ADMIN_USER_ASSIGN_ROLE)
  @Delete('users/:id/roles/:roleId')
  removeRoleFromUser(
    @CurrentUser() user: CachedUser,
    @Param('id', new ParseUUIDPipe({ version: '7' })) userId: string,
    @Param('roleId', new ParseUUIDPipe({ version: '7' })) roleId: string,
  ) {
    return this.usersService.removeRoleFromUser(user.id, userId, roleId);
  }

  @ApiOperation({ summary: 'Delete a user' })
  @ApiResponse({
    status: 200,
    type: UserDeletedResponseDto,
    description: 'User deleted',
  })
  @ApiResponse({
    status: 400,
    description:
      'User still has roles, remove them first (admin.user.has_roles) or invalid ID (must be an integer)',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
    type: ErrorResponseDto,
  })
  @RequirePermissions(Permissions.ADMIN_USER_DELETE)
  @Delete('users/:id')
  deleteUser(
    @CurrentUser() user: CachedUser,
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
  ) {
    return this.usersService.deleteUser(user.id, id);
  }

  @ApiOperation({ summary: "List a user's active sessions" })
  @ApiPaginatedResponse(
    SessionResponseDto,
    "Paginated list of the user's active (non-expired) sessions",
  )
  @ApiResponse({
    status: 400,
    description:
      'Invalid query parameter (validation.failed) or invalid ID (must be an integer)',
    type: ValidationErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found (admin.user.not_found)',
    type: ErrorResponseDto,
  })
  @RequirePermissions(Permissions.ADMIN_USER_SESSION_READ)
  @Get('users/:id/sessions')
  findUserSessions(
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
    @Query() query: FindSessionsQueryDto,
  ) {
    return this.usersService.findUserSessions(id, query);
  }

  @ApiOperation({ summary: 'Revoke a specific session of a user' })
  @ApiResponse({
    status: 200,
    type: UserSessionRevokedResponseDto,
    description: 'Session revoked',
  })
  @ApiInvalidIdError()
  @ApiResponse({
    status: 404,
    description:
      'Session not found for this user (admin.user.session.not_found)',
    type: ErrorResponseDto,
  })
  @RequirePermissions(Permissions.ADMIN_USER_SESSION_REVOKE)
  @Delete('users/:id/sessions/:sessionId')
  revokeUserSession(
    @CurrentUser() user: CachedUser,
    @Param('id', new ParseUUIDPipe({ version: '7' })) userId: string,
    @Param('sessionId', new ParseUUIDPipe({ version: '7' })) sessionId: string,
  ) {
    return this.usersService.revokeUserSession(user.id, userId, sessionId);
  }

  @ApiOperation({ summary: 'Revoke all sessions of a user' })
  @ApiResponse({
    status: 200,
    type: UserSessionsRevokedResponseDto,
    description:
      'All sessions revoked (params.count = number of active sessions revoked)',
  })
  @ApiInvalidIdError()
  @ApiResponse({
    status: 404,
    description: 'User not found (admin.user.not_found)',
    type: ErrorResponseDto,
  })
  @RequirePermissions(Permissions.ADMIN_USER_SESSION_REVOKE)
  @Delete('users/:id/sessions')
  revokeAllUserSessions(
    @CurrentUser() user: CachedUser,
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
  ) {
    return this.usersService.revokeAllUserSessions(user.id, id);
  }
}
