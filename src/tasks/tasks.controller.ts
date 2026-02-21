import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { Request } from 'express';
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
  cleanupUnverifiedUsers(@Req() req: Request) {
    return this.tasksService.cleanupUnverifiedUsers(
      (req.user as any).id as number,
    );
  }

  @ApiOperation({
    summary:
      'Forcer le nettoyage des tokens expirés (refresh + password reset)',
  })
  @ApiResponse({ status: 200, description: 'Tokens expirés supprimés' })
  @RequirePermissions(Permissions.TASK_CLEAN_TOKENS)
  @Post('cleanup-expired-tokens')
  @HttpCode(200)
  cleanupExpiredTokens(@Req() req: Request) {
    return this.tasksService.cleanupExpiredTokens(
      (req.user as any).id as number,
    );
  }

  @ApiOperation({
    summary: 'Supprimer les permissions orphelines (absentes des constantes)',
  })
  @ApiResponse({
    status: 200,
    description: 'Permissions orphelines supprimées',
  })
  @RequirePermissions(Permissions.TASK_CLEAN_PERMISSIONS)
  @Post('cleanup-orphaned-permissions')
  @HttpCode(200)
  cleanupOrphanedPermissions(@Req() req: Request) {
    return this.tasksService.cleanupOrphanedPermissions(
      (req.user as any).id as number,
    );
  }

  @ApiOperation({
    summary: "Supprimer les logs d'audit plus vieux que N jours",
  })
  @ApiResponse({ status: 200, description: 'Logs supprimés' })
  @ApiResponse({
    status: 400,
    description: 'Paramètre invalide (minimum 1 jour)',
  })
  @RequirePermissions(Permissions.TASK_CLEAN_AUDIT)
  @Post('cleanup-audit-logs')
  @HttpCode(200)
  cleanupAuditLogs(@Req() req: Request, @Body() dto: CleanupAuditLogsDto) {
    return this.tasksService.cleanupAuditLogs(
      dto.olderThanDays,
      (req.user as any).id as number,
    );
  }
}
