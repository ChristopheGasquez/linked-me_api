import { Controller, Get, Post, Delete, Param, Body, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AdminRolesService } from './roles.service.js';
import { CreateRoleDto } from './dto/create-role.dto.js';
import { AssignPermissionsDto } from './dto/assign-permissions.dto.js';
import { FindRolesQueryDto } from './dto/find-roles-query.dto.js';
import { FindPermissionsQueryDto } from './dto/find-permissions-query.dto.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../auth/guards/permissions.guard.js';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator.js';
import { Permissions } from '../../auth/permissions.constants.js';

@ApiTags('Admin / Roles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(Permissions.REALM_ADMIN)
@Controller('admin')
export class AdminRolesController {
  constructor(private rolesService: AdminRolesService) {}

  // ─── Rôles ───────────────────────────────────────────────

  @ApiOperation({ summary: 'Lister tous les rôles avec leurs permissions' })
  @RequirePermissions(Permissions.ADMIN_ROLE_READ)
  @Get('roles')
  findAllRoles(@Query() query: FindRolesQueryDto) {
    return this.rolesService.findAllRoles(query);
  }

  @ApiOperation({ summary: 'Récupérer un rôle par son ID' })
  @ApiResponse({ status: 200, description: 'Rôle trouvé' })
  @ApiResponse({ status: 404, description: 'Rôle non trouvé' })
  @RequirePermissions(Permissions.ADMIN_ROLE_READ)
  @Get('roles/:id')
  findRoleById(@Param('id', ParseIntPipe) id: number) {
    return this.rolesService.findRoleById(id);
  }

  @ApiOperation({ summary: 'Créer un nouveau rôle' })
  @ApiResponse({ status: 201, description: 'Rôle créé' })
  @ApiResponse({ status: 400, description: 'Le rôle existe déjà' })
  @RequirePermissions(Permissions.ADMIN_ROLE_MANAGE)
  @Post('roles')
  createRole(@Body() dto: CreateRoleDto) {
    return this.rolesService.createRole(dto.name);
  }

  @ApiOperation({ summary: 'Supprimer un rôle (si non assigné à un utilisateur)' })
  @ApiResponse({ status: 200, description: 'Rôle supprimé' })
  @ApiResponse({ status: 400, description: 'Rôle encore assigné à des utilisateurs' })
  @ApiResponse({ status: 404, description: 'Rôle non trouvé' })
  @RequirePermissions(Permissions.ADMIN_ROLE_MANAGE)
  @Delete('roles/:id')
  deleteRole(@Param('id', ParseIntPipe) id: number) {
    return this.rolesService.deleteRole(id);
  }

  // ─── Permissions sur un rôle ─────────────────────────────

  @ApiOperation({ summary: 'Ajouter des permissions à un rôle' })
  @ApiResponse({ status: 200, description: 'Permissions ajoutées, retourne le rôle mis à jour' })
  @ApiResponse({ status: 400, description: 'Permissions inconnues' })
  @ApiResponse({ status: 404, description: 'Rôle non trouvé' })
  @RequirePermissions(Permissions.ADMIN_ROLE_MANAGE)
  @Post('roles/:id/permissions')
  addPermissions(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignPermissionsDto,
  ) {
    return this.rolesService.addPermissionsToRole(id, dto.permissions);
  }

  @ApiOperation({ summary: "Retirer une permission d'un rôle" })
  @ApiResponse({ status: 200, description: 'Permission retirée' })
  @ApiResponse({ status: 404, description: 'Association non trouvée' })
  @RequirePermissions(Permissions.ADMIN_ROLE_MANAGE)
  @Delete('roles/:id/permissions/:permId')
  removePermission(
    @Param('id', ParseIntPipe) id: number,
    @Param('permId', ParseIntPipe) permId: number,
  ) {
    return this.rolesService.removePermissionFromRole(id, permId);
  }

  // ─── Permissions (consultation) ──────────────────────────

  @ApiOperation({ summary: 'Lister toutes les permissions disponibles' })
  @RequirePermissions(Permissions.ADMIN_PERMISSION_READ)
  @Get('permissions')
  findAllPermissions(@Query() query: FindPermissionsQueryDto) {
    return this.rolesService.findAllPermissions(query);
  }
}
