import { ApiProperty } from '@nestjs/swagger';

export class CleanupTokensResponseDto {
  @ApiProperty({ example: '5 expired token(s) deleted' }) message: string;
  @ApiProperty({ example: 'task.cleanup.expired_tokens.done' }) code: string;
  @ApiProperty() refreshTokens: number;
  @ApiProperty() passwordResets: number;
}

export class CleanupAuditLogsResponseDto {
  @ApiProperty({ example: '120 audit log(s) deleted' }) message: string;
  @ApiProperty({ example: 'task.cleanup.audit_logs.done' }) code: string;
  @ApiProperty() olderThanDays: number;
}

export class CleanupOrphanedPermissionsResponseDto {
  @ApiProperty({ example: '2 orphaned permission(s) deleted' }) message: string;
  @ApiProperty({ example: 'task.cleanup.orphaned_permissions.done' }) code: string;
  @ApiProperty({ type: [String] }) deleted: string[];
}
