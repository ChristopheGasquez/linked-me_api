import { ApiProperty } from '@nestjs/swagger';
import { MessageResponseDto } from '../../../common/dto/message-response.dto.js';

// ─── Cleanup unverified users ─────────────────────────────────────────────────

class CleanupUnverifiedUsersParamsDto {
  @ApiProperty({ example: 5 }) count: number;
}

export class CleanupUnverifiedUsersResponseDto extends MessageResponseDto {
  @ApiProperty({ example: '5 unverified account(s) deleted' })
  declare message: string;

  @ApiProperty({ example: 'task.cleanup.unverified_users.done' })
  declare code: string;

  @ApiProperty({ type: CleanupUnverifiedUsersParamsDto })
  declare params: CleanupUnverifiedUsersParamsDto;
}

// ─── Cleanup expired tokens ───────────────────────────────────────────────────

class CleanupExpiredTokensParamsDto {
  @ApiProperty({ example: 8 }) count: number;
  @ApiProperty({ example: 6 }) refreshTokens: number;
  @ApiProperty({ example: 2 }) passwordResets: number;
}

export class CleanupExpiredTokensResponseDto extends MessageResponseDto {
  @ApiProperty({ example: '8 expired token(s) deleted' })
  declare message: string;

  @ApiProperty({ example: 'task.cleanup.expired_tokens.done' })
  declare code: string;

  @ApiProperty({ type: CleanupExpiredTokensParamsDto })
  declare params: CleanupExpiredTokensParamsDto;
}

// ─── Cleanup audit logs ───────────────────────────────────────────────────────

class CleanupAuditLogsParamsDto {
  @ApiProperty({ example: 120 }) count: number;
  @ApiProperty({ example: 30 }) olderThanDays: number;
}

export class CleanupAuditLogsResponseDto extends MessageResponseDto {
  @ApiProperty({ example: '120 audit log(s) deleted' })
  declare message: string;

  @ApiProperty({ example: 'task.cleanup.audit_logs.done' })
  declare code: string;

  @ApiProperty({ type: CleanupAuditLogsParamsDto })
  declare params: CleanupAuditLogsParamsDto;
}

// ─── Cleanup orphaned permissions ─────────────────────────────────────────────

class CleanupOrphanedPermissionsParamsDto {
  @ApiProperty({ example: 2 }) count: number;
  @ApiProperty({ type: [String], example: ['obsolete:permission'] })
  deleted: string[];
}

export class CleanupOrphanedPermissionsResponseDto extends MessageResponseDto {
  @ApiProperty({ example: '2 orphaned permission(s) deleted' })
  declare message: string;

  @ApiProperty({
    example: 'task.cleanup.orphaned_permissions.done',
    description:
      'or task.cleanup.orphaned_permissions.none when there is nothing to delete',
  })
  declare code: string;

  @ApiProperty({ type: CleanupOrphanedPermissionsParamsDto })
  declare params: CleanupOrphanedPermissionsParamsDto;
}
