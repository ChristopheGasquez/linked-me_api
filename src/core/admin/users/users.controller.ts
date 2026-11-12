import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
  Request,
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
} from './dto/user-success.dto.js';
import {
  RoleNotFoundErrorDto,
  UserRoleAlreadyAssignedErrorDto,
} from './dto/user-error.dto.js';
import { ApiPaginatedResponse } from '../../../common/pagination/index.js';
import {
  ApiAuthErrors,
  ApiInvalidIdError,
  ApiThrottleError,
  ApiValidationError,
} from '../../../common/swagger/api-common-responses.decorator.js';

@ApiTags('Admin / Users')
@ApiAuthErrors()
@ApiThrottleError()
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
  findUserById(@Param('id', ParseIntPipe) id: number) {
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
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignRoleDto,
  ) {
    return this.usersService.addRoleToUser(req.user.id, id, dto.role);
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
    @Request() req: any,
    @Param('id', ParseIntPipe) userId: number,
    @Param('roleId', ParseIntPipe) roleId: number,
  ) {
    return this.usersService.removeRoleFromUser(req.user.id, userId, roleId);
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
  deleteUser(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.usersService.deleteUser(req.user.id, id);
  }
}
