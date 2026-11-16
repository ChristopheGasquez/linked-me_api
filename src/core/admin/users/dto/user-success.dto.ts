import { ApiProperty } from '@nestjs/swagger';
import { MessageResponseDto } from '../../../../common/dto/message-response.dto.js';

// ─── Role assigned to user ─────────────────────────────────────────────────────

class UserRoleAssignedParamsDto {
  @ApiProperty({ example: 'MODERATOR' }) roleName: string;
  @ApiProperty({ example: 42 }) userId: number;
}

export class UserRoleAssignedResponseDto extends MessageResponseDto {
  @ApiProperty({ example: 'Role assigned to user' })
  declare message: string;

  @ApiProperty({ example: 'admin.user.role.assigned' })
  declare code: string;

  @ApiProperty({ type: UserRoleAssignedParamsDto })
  declare params: UserRoleAssignedParamsDto;
}

// ─── Role removed from user ────────────────────────────────────────────────────

export class UserRoleRemovedResponseDto extends MessageResponseDto {
  @ApiProperty({ example: 'Role removed from user' })
  declare message: string;

  @ApiProperty({ example: 'admin.user.role.removed' })
  declare code: string;
}

// ─── User deleted ──────────────────────────────────────────────────────────────

class UserDeletedParamsDto {
  @ApiProperty({ example: 42 }) userId: number;
}

export class UserDeletedResponseDto extends MessageResponseDto {
  @ApiProperty({ example: 'User deleted' })
  declare message: string;

  @ApiProperty({ example: 'admin.user.deleted' })
  declare code: string;

  @ApiProperty({ type: UserDeletedParamsDto })
  declare params: UserDeletedParamsDto;
}

// ─── Session revoked ───────────────────────────────────────────────────────────

class UserSessionRevokedParamsDto {
  @ApiProperty({ example: 42 }) userId: number;
  @ApiProperty({ example: 7 }) sessionId: number;
}

export class UserSessionRevokedResponseDto extends MessageResponseDto {
  @ApiProperty({ example: 'Session revoked' })
  declare message: string;

  @ApiProperty({ example: 'admin.user.session.revoked' })
  declare code: string;

  @ApiProperty({ type: UserSessionRevokedParamsDto })
  declare params: UserSessionRevokedParamsDto;
}

// ─── All sessions revoked ──────────────────────────────────────────────────────

class UserSessionsRevokedParamsDto {
  @ApiProperty({ example: 42 }) userId: number;
  @ApiProperty({
    example: 3,
    description: 'Number of active (non-expired) sessions revoked',
  })
  count: number;
}

export class UserSessionsRevokedResponseDto extends MessageResponseDto {
  @ApiProperty({ example: 'All sessions revoked' })
  declare message: string;

  @ApiProperty({ example: 'admin.user.sessions.revoked' })
  declare code: string;

  @ApiProperty({ type: UserSessionsRevokedParamsDto })
  declare params: UserSessionsRevokedParamsDto;
}
