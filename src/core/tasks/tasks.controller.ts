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
import {
  CleanupTokensResponseDto,
  CleanupAuditLogsResponseDto,
  CleanupOrphanedPermissionsResponseDto,
} from './dto/cleanup-response.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { Permissions } from '../auth/permissions.constants.js';
import { MessageResponseDto } from '../../common/dto/message-response.dto.js';
import { ErrorResponseDto } from '../../common/dto/error-response.dto.js';

@ApiTags('Tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(Permissions.REALM_TASK)
@Controller('tasks')
export class TasksController {
  constructor(private tasksService: TasksService) {}

  @ApiOperation({ summary: 'Force cleanup of unverified accounts' })
  @ApiResponse({ status: 200, type: MessageResponseDto, description: 'Cleanup done' })
  @RequirePermissions(Permissions.TASK_CLEAN_USERS)
  @Post('cleanup-unverified-users')
  @HttpCode(200)
  cleanupUnverifiedUsers(@Req() req: Request) {
    return this.tasksService.cleanupUnverifiedUsers(
      (req.user as any).id as number,
    );
  }

  @ApiOperation({ summary: 'Force cleanup of expired tokens (refresh + password reset)' })
  @ApiResponse({ status: 200, type: CleanupTokensResponseDto, description: 'Expired tokens deleted' })
  @RequirePermissions(Permissions.TASK_CLEAN_TOKENS)
  @Post('cleanup-expired-tokens')
  @HttpCode(200)
  cleanupExpiredTokens(@Req() req: Request) {
    return this.tasksService.cleanupExpiredTokens(
      (req.user as any).id as number,
    );
  }

  @ApiOperation({ summary: 'Delete orphaned permissions (absent from constants)' })
  @ApiResponse({ status: 200, type: CleanupOrphanedPermissionsResponseDto, description: 'Orphaned permissions deleted' })
  @RequirePermissions(Permissions.TASK_CLEAN_PERMISSIONS)
  @Post('cleanup-orphaned-permissions')
  @HttpCode(200)
  cleanupOrphanedPermissions(@Req() req: Request) {
    return this.tasksService.cleanupOrphanedPermissions(
      (req.user as any).id as number,
    );
  }

  @ApiOperation({ summary: 'Delete audit logs older than N days' })
  @ApiResponse({ status: 200, type: CleanupAuditLogsResponseDto, description: 'Logs deleted' })
  @ApiResponse({ status: 400, description: 'Invalid parameter (minimum 1 day)', type: ErrorResponseDto })
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
