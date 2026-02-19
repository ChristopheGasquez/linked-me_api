import { Controller, Post, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { MaintenanceService } from './maintenance.service.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../auth/guards/permissions.guard.js';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator.js';
import { Permissions } from '../../auth/permissions.constants.js';

@ApiTags('Admin / Maintenance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(Permissions.REALM_ADMIN)
@Controller('admin')
export class MaintenanceController {
  constructor(private maintenanceService: MaintenanceService) {}

  @ApiOperation({ summary: 'Forcer le nettoyage des comptes non vérifiés' })
  @ApiResponse({ status: 200, description: 'Nettoyage effectué' })
  @RequirePermissions(Permissions.ADMIN_CLEAN_USERS)
  @Post('cleanup-unverified-users')
  @HttpCode(200)
  cleanupUnverifiedUsers() {
    return this.maintenanceService.cleanupUnverifiedUsers();
  }

  @ApiOperation({ summary: 'Supprimer les permissions orphelines (absentes des constantes)' })
  @ApiResponse({ status: 200, description: 'Permissions orphelines supprimées' })
  @RequirePermissions(Permissions.ADMIN_CLEAN_PERMISSIONS)
  @Post('cleanup-orphaned-permissions')
  @HttpCode(200)
  cleanupOrphanedPermissions() {
    return this.maintenanceService.cleanupOrphanedPermissions();
  }
}
