import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { TasksService } from './tasks.service.js';
import { CleanupAuditLogsDto } from './dto/cleanup-audit-logs.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { Permissions } from '../auth/permissions.constants.js';
import {
  CleanupUnverifiedUsersResponseDto,
  CleanupExpiredTokensResponseDto,
  CleanupOrphanedPermissionsResponseDto,
  CleanupAuditLogsResponseDto,
} from './dto/cleanup-response.dto.js';
import { TaskListResponseDto } from './dto/task-list-response.dto.js';
import {
  ApiAuthErrors,
  ApiThrottleError,
  ApiValidationError,
} from '../../common/swagger/api-common-responses.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { CachedUser } from '../auth/cache/user-cache.service.js';

@ApiTags('Tasks')
@ApiAuthErrors()
@ApiThrottleError()
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(Permissions.REALM_TASK)
@Controller('tasks')
export class TasksController {
  constructor(private tasksService: TasksService) {}

  @ApiOperation({
    summary: 'List maintenance tasks (schedule, config, permission, last run)',
  })
  @ApiResponse({ status: 200, type: TaskListResponseDto, description: 'Tasks' })
  @Get()
  findAll(@CurrentUser() user: CachedUser) {
    return this.tasksService.findAll(user.permissions);
  }

  @ApiOperation({ summary: 'Force cleanup of unverified accounts' })
  @ApiResponse({
    status: 200,
    type: CleanupUnverifiedUsersResponseDto,
    description: 'Cleanup done',
  })
  @RequirePermissions(Permissions.TASK_CLEAN_USERS)
  @Post('cleanup-unverified-users')
  @HttpCode(200)
  cleanupUnverifiedUsers(@CurrentUser() user: CachedUser) {
    return this.tasksService.cleanupUnverifiedUsers(user.id);
  }

  @ApiOperation({
    summary: 'Force cleanup of expired tokens (refresh + password reset)',
  })
  @ApiResponse({
    status: 200,
    type: CleanupExpiredTokensResponseDto,
    description: 'Expired tokens deleted',
  })
  @RequirePermissions(Permissions.TASK_CLEAN_TOKENS)
  @Post('cleanup-expired-tokens')
  @HttpCode(200)
  cleanupExpiredTokens(@CurrentUser() user: CachedUser) {
    return this.tasksService.cleanupExpiredTokens(user.id);
  }

  @ApiOperation({
    summary: 'Delete orphaned permissions (absent from constants)',
  })
  @ApiResponse({
    status: 200,
    type: CleanupOrphanedPermissionsResponseDto,
    description: 'Orphaned permissions deleted',
  })
  @RequirePermissions(Permissions.TASK_CLEAN_PERMISSIONS)
  @Post('cleanup-orphaned-permissions')
  @HttpCode(200)
  cleanupOrphanedPermissions(@CurrentUser() user: CachedUser) {
    return this.tasksService.cleanupOrphanedPermissions(user.id);
  }

  @ApiOperation({ summary: 'Delete audit logs older than N days' })
  @ApiResponse({
    status: 200,
    type: CleanupAuditLogsResponseDto,
    description: 'Logs deleted',
  })
  @ApiValidationError(
    'olderThanDays missing, not an integer or < 1 — code: validation.failed',
  )
  @RequirePermissions(Permissions.TASK_CLEAN_AUDIT)
  @Post('cleanup-audit-logs')
  @HttpCode(200)
  cleanupAuditLogs(
    @CurrentUser() user: CachedUser,
    @Body() dto: CleanupAuditLogsDto,
  ) {
    return this.tasksService.cleanupAuditLogs(dto.olderThanDays, user.id);
  }
}
