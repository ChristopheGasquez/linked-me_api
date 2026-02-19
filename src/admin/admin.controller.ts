import { Controller, Get, Post, Delete, Param, Body, Query, UseGuards, ParseIntPipe, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service.js';
import { CreateRoleDto } from './dto/create-role.dto.js';
import { AssignPermissionsDto } from './dto/assign-permissions.dto.js';
import { AssignRoleDto } from './dto/assign-role.dto.js';
import { FindUsersQueryDto } from './dto/find-users-query.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { Permissions } from '../auth/permissions.constants.js';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(Permissions.ROLE_MANAGE)
@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  // ─── Rôles ───────────────────────────────────────────────

  @ApiOperation({ summary: 'Lister tous les rôles avec leurs permissions' })
  @Get('roles')
  findAllRoles() {
    return this.adminService.findAllRoles();
  }

  @ApiOperation({ summary: 'Créer un nouveau rôle' })
  @ApiResponse({ status: 201, description: 'Rôle créé' })
  @ApiResponse({ status: 400, description: 'Le rôle existe déjà' })
  @Post('roles')
  createRole(@Body() dto: CreateRoleDto) {
    return this.adminService.createRole(dto.name);
  }

  @ApiOperation({ summary: 'Supprimer un rôle (si non assigné à un utilisateur)' })
  @ApiResponse({ status: 200, description: 'Rôle supprimé' })
  @ApiResponse({ status: 400, description: 'Rôle encore assigné à des utilisateurs' })
  @ApiResponse({ status: 404, description: 'Rôle non trouvé' })
  @Delete('roles/:id')
  deleteRole(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteRole(id);
  }

  // ─── Permissions sur un rôle ─────────────────────────────

  @ApiOperation({ summary: 'Ajouter des permissions à un rôle' })
  @ApiResponse({ status: 200, description: 'Permissions ajoutées, retourne le rôle mis à jour' })
  @ApiResponse({ status: 400, description: 'Permissions inconnues' })
  @ApiResponse({ status: 404, description: 'Rôle non trouvé' })
  @Post('roles/:id/permissions')
  addPermissions(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignPermissionsDto,
  ) {
    return this.adminService.addPermissionsToRole(id, dto.permissions);
  }

  @ApiOperation({ summary: 'Retirer une permission d\'un rôle' })
  @ApiResponse({ status: 200, description: 'Permission retirée' })
  @ApiResponse({ status: 404, description: 'Association non trouvée' })
  @Delete('roles/:id/permissions/:permId')
  removePermission(
    @Param('id', ParseIntPipe) id: number,
    @Param('permId', ParseIntPipe) permId: number,
  ) {
    return this.adminService.removePermissionFromRole(id, permId);
  }

  // ─── Permissions (consultation) ──────────────────────────

  @ApiOperation({ summary: 'Lister toutes les permissions disponibles' })
  @Get('permissions')
  findAllPermissions() {
    return this.adminService.findAllPermissions();
  }

  // ─── Utilisateurs ────────────────────────────────────────

  @ApiOperation({ summary: 'Lister les utilisateurs avec pagination, tri et filtres' })
  @ApiResponse({ status: 200, description: 'Liste paginée des utilisateurs' })
  @Get('users')
  findAllUsers(@Query() query: FindUsersQueryDto) {
    return this.adminService.findAllUsers(query);
  }

  @ApiOperation({ summary: 'Récupérer un utilisateur par son ID' })
  @ApiResponse({ status: 200, description: 'Utilisateur trouvé' })
  @ApiResponse({ status: 404, description: 'Utilisateur non trouvé' })
  @Get('users/:id')
  findUserById(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.findUserById(id);
  }

  @ApiOperation({ summary: 'Assigner un rôle à un utilisateur' })
  @ApiResponse({ status: 201, description: 'Rôle assigné' })
  @ApiResponse({ status: 400, description: 'L\'utilisateur a déjà ce rôle' })
  @ApiResponse({ status: 404, description: 'Utilisateur ou rôle non trouvé' })
  @Post('users/:id/roles')
  addRoleToUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignRoleDto,
  ) {
    return this.adminService.addRoleToUser(id, dto.role);
  }

  @ApiOperation({ summary: 'Retirer un rôle d\'un utilisateur' })
  @ApiResponse({ status: 200, description: 'Rôle retiré' })
  @ApiResponse({ status: 404, description: 'Association non trouvée' })
  @Delete('users/:id/roles/:roleId')
  removeRoleFromUser(
    @Param('id', ParseIntPipe) userId: number,
    @Param('roleId', ParseIntPipe) roleId: number,
  ) {
    return this.adminService.removeRoleFromUser(userId, roleId);
  }

  @ApiOperation({ summary: 'Supprimer un utilisateur (si aucun rôle assigné)' })
  @ApiResponse({ status: 200, description: 'Utilisateur supprimé' })
  @ApiResponse({ status: 400, description: 'L\'utilisateur a encore des rôles' })
  @ApiResponse({ status: 404, description: 'Utilisateur non trouvé' })
  @RequirePermissions(Permissions.USER_DELETE_ANY)
  @Delete('users/:id')
  deleteUser(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteUser(id);
  }

  // ─── Maintenance ───────────────────────────────────────

  @ApiOperation({ summary: 'Forcer le nettoyage des comptes non vérifiés' })
  @ApiResponse({ status: 200, description: 'Nettoyage effectué' })
  @RequirePermissions(Permissions.USER_DELETE_ANY)
  @Post('cleanup-unverified-users')
  @HttpCode(200)
  cleanupUnverifiedUsers() {
    return this.adminService.cleanupUnverifiedUsers();
  }
}
