import { Controller, Get, Post, Delete, Param, Body, UseGuards, ParseIntPipe } from '@nestjs/common';
import { AdminService } from './admin.service.js';
import { CreateRoleDto } from './dto/create-role.dto.js';
import { AssignPermissionsDto } from './dto/assign-permissions.dto.js';
import { AssignRoleDto } from './dto/assign-role.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { Permissions } from '../auth/permissions.constants.js';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(Permissions.ROLE_MANAGE)
@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  // ─── Rôles ───────────────────────────────────────────────

  // GET /admin/roles — Lister tous les rôles avec leurs permissions
  @Get('roles')
  findAllRoles() {
    return this.adminService.findAllRoles();
  }

  // POST /admin/roles — Créer un nouveau rôle
  @Post('roles')
  createRole(@Body() dto: CreateRoleDto) {
    return this.adminService.createRole(dto.name);
  }

  // DELETE /admin/roles/:id — Supprimer un rôle (si non assigné)
  @Delete('roles/:id')
  deleteRole(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteRole(id);
  }

  // ─── Permissions sur un rôle ─────────────────────────────

  // POST /admin/roles/:id/permissions — Ajouter des permissions à un rôle
  @Post('roles/:id/permissions')
  addPermissions(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignPermissionsDto,
  ) {
    return this.adminService.addPermissionsToRole(id, dto.permissions);
  }

  // DELETE /admin/roles/:id/permissions/:permId — Retirer une permission d'un rôle
  @Delete('roles/:id/permissions/:permId')
  removePermission(
    @Param('id', ParseIntPipe) id: number,
    @Param('permId', ParseIntPipe) permId: number,
  ) {
    return this.adminService.removePermissionFromRole(id, permId);
  }

  // ─── Permissions (consultation) ──────────────────────────

  // GET /admin/permissions — Lister toutes les permissions disponibles
  @Get('permissions')
  findAllPermissions() {
    return this.adminService.findAllPermissions();
  }

  // ─── Utilisateurs ────────────────────────────────────────

  // GET /admin/users — Lister tous les utilisateurs avec leurs rôles
  @Get('users')
  findAllUsers() {
    return this.adminService.findAllUsers();
  }

  // POST /admin/users/:id/roles — Assigner un rôle à un utilisateur
  @Post('users/:id/roles')
  addRoleToUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignRoleDto,
  ) {
    return this.adminService.addRoleToUser(id, dto.role);
  }

  // DELETE /admin/users/:id/roles/:roleId — Retirer un rôle d'un utilisateur
  @Delete('users/:id/roles/:roleId')
  removeRoleFromUser(
    @Param('id', ParseIntPipe) userId: number,
    @Param('roleId', ParseIntPipe) roleId: number,
  ) {
    return this.adminService.removeRoleFromUser(userId, roleId);
  }
}
