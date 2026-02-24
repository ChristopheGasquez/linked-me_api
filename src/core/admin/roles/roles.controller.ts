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
import { AdminRolesService } from './roles.service.js';
import { CreateRoleDto } from './dto/create-role.dto.js';
import { AssignPermissionsDto } from './dto/assign-permissions.dto.js';
import { FindRolesQueryDto } from './dto/find-roles-query.dto.js';
import { FindPermissionsQueryDto } from './dto/find-permissions-query.dto.js';
import {
  PermissionResponseDto,
  RoleBasicResponseDto,
  RoleResponseDto,
} from './dto/role-response.dto.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../auth/guards/permissions.guard.js';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator.js';
import { Permissions } from '../../auth/permissions.constants.js';
import { MessageResponseDto } from '../../../common/dto/message-response.dto.js';
import { ErrorResponseDto } from '../../../common/dto/error-response.dto.js';
import { ApiPaginatedResponse } from '../../../common/pagination/index.js';

@ApiTags('Admin / Roles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(Permissions.REALM_ADMIN)
@Controller('admin')
export class AdminRolesController {
  constructor(private rolesService: AdminRolesService) {}

  // ─── Rôles ───────────────────────────────────────────────

  @ApiOperation({ summary: 'List all roles with their permissions' })
  @ApiPaginatedResponse(RoleResponseDto, 'Paginated list of roles')
  @RequirePermissions(Permissions.ADMIN_ROLE_READ)
  @Get('roles')
  findAllRoles(@Query() query: FindRolesQueryDto) {
    return this.rolesService.findAllRoles(query);
  }

  @ApiOperation({ summary: 'Get a role by ID' })
  @ApiResponse({ status: 200, type: RoleResponseDto, description: 'Role found' })
  @ApiResponse({ status: 404, description: 'Role not found', type: ErrorResponseDto })
  @RequirePermissions(Permissions.ADMIN_ROLE_READ)
  @Get('roles/:id')
  findRoleById(@Param('id', ParseIntPipe) id: number) {
    return this.rolesService.findRoleById(id);
  }

  @ApiOperation({ summary: 'Create a new role' })
  @ApiResponse({ status: 201, type: RoleBasicResponseDto, description: 'Role created' })
  @ApiResponse({ status: 400, description: 'Role already exists', type: ErrorResponseDto })
  @RequirePermissions(Permissions.ADMIN_ROLE_MANAGE)
  @Post('roles')
  createRole(@Request() req: any, @Body() dto: CreateRoleDto) {
    return this.rolesService.createRole(req.user.id, dto.name);
  }

  @ApiOperation({ summary: 'Delete a role (if not assigned to any user)' })
  @ApiResponse({ status: 200, type: MessageResponseDto, description: 'Role deleted' })
  @ApiResponse({ status: 400, description: 'Role still assigned to users', type: ErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Role not found', type: ErrorResponseDto })
  @RequirePermissions(Permissions.ADMIN_ROLE_MANAGE)
  @Delete('roles/:id')
  deleteRole(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.rolesService.deleteRole(req.user.id, id);
  }

  // ─── Permissions sur un rôle ─────────────────────────────

  @ApiOperation({ summary: 'Add permissions to a role' })
  @ApiResponse({ status: 200, type: RoleResponseDto, description: 'Permissions added, returns the updated role' })
  @ApiResponse({ status: 400, description: 'Unknown permissions', type: ErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Role not found', type: ErrorResponseDto })
  @RequirePermissions(Permissions.ADMIN_ROLE_MANAGE)
  @Post('roles/:id/permissions')
  addPermissions(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignPermissionsDto,
  ) {
    return this.rolesService.addPermissionsToRole(
      req.user.id,
      id,
      dto.permissions,
    );
  }

  @ApiOperation({ summary: 'Remove a permission from a role' })
  @ApiResponse({ status: 200, type: MessageResponseDto, description: 'Permission removed' })
  @ApiResponse({ status: 404, description: 'Association not found', type: ErrorResponseDto })
  @RequirePermissions(Permissions.ADMIN_ROLE_MANAGE)
  @Delete('roles/:id/permissions/:permId')
  removePermission(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Param('permId', ParseIntPipe) permId: number,
  ) {
    return this.rolesService.removePermissionFromRole(req.user.id, id, permId);
  }

  // ─── Permissions (consultation) ──────────────────────────

  @ApiOperation({ summary: 'List all available permissions' })
  @ApiPaginatedResponse(PermissionResponseDto, 'Paginated list of permissions')
  @RequirePermissions(Permissions.ADMIN_PERMISSION_READ)
  @Get('permissions')
  findAllPermissions(@Query() query: FindPermissionsQueryDto) {
    return this.rolesService.findAllPermissions(query);
  }
}
