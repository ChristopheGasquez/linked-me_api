import { Controller, Post, Body, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TasksService } from './tasks.service.js';
import { CleanupAuditLogsDto } from './dto/cleanup-audit-logs.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { Permissions } from '../auth/permissions.constants.js';

@ApiTags('Tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(Permissions.REALM_TASK)
@Controller('tasks')
export class TasksController {
  constructor(private tasksService: TasksService) {}

  @ApiOperation({ summary: 'Forcer le nettoyage des comptes non vérifiés' })
  @ApiResponse({ status: 200, description: 'Nettoyage effectué' })
  @RequirePermissions(Permissions.TASK_CLEAN_USERS)
  @Post('cleanup-unverified-users')
  @HttpCode(200)
  cleanupUnverifiedUsers() {
    return this.tasksService.cleanupUnverifiedUsers();
  }

  @ApiOperation({ summary: 'Forcer le nettoyage des tokens expirés (refresh + password reset)' })
  @ApiResponse({ status: 200, description: 'Tokens expirés supprimés' })
  @RequirePermissions(Permissions.TASK_CLEAN_TOKENS)
  @Post('cleanup-expired-tokens')
  @HttpCode(200)
  cleanupExpiredTokens() {
    return this.tasksService.cleanupExpiredTokens();
  }

  @ApiOperation({ summary: 'Supprimer les permissions orphelines (absentes des constantes)' })
  @ApiResponse({ status: 200, description: 'Permissions orphelines supprimées' })
  @RequirePermissions(Permissions.TASK_CLEAN_PERMISSIONS)
  @Post('cleanup-orphaned-permissions')
  @HttpCode(200)
  cleanupOrphanedPermissions() {
    return this.tasksService.cleanupOrphanedPermissions();
  }

  @ApiOperation({ summary: 'Supprimer les logs d\'audit plus vieux que N jours' })
  @ApiResponse({ status: 200, description: 'Logs supprimés' })
  @ApiResponse({ status: 400, description: 'Paramètre invalide (minimum 1 jour)' })
  @RequirePermissions(Permissions.TASK_CLEAN_AUDIT)
  @Post('cleanup-audit-logs')
  @HttpCode(200)
  cleanupAuditLogs(@Body() dto: CleanupAuditLogsDto) {
    return this.tasksService.cleanupAuditLogs(dto.olderThanDays);
  }
}
