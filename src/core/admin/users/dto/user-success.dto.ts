import { ApiProperty } from '@nestjs/swagger';
import { MessageResponseDto } from '../../../../common/dto/message-response.dto.js';
import { ApiIdProperty } from '../../../../common/swagger/api-id-property.decorator.js';

// ─── Role assigned to user ─────────────────────────────────────────────────────

class UserRoleAssignedParamsDto {
  @ApiProperty({ example: 'MODERATOR' }) roleName: string;
  @ApiIdProperty() userId: string;
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
  @ApiIdProperty() userId: string;
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
  @ApiIdProperty() userId: string;
  @ApiIdProperty() sessionId: string;
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
  @ApiIdProperty() userId: string;
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
