import { ApiProperty } from '@nestjs/swagger';
import { MessageResponseDto } from '../../../../common/dto/message-response.dto.js';

// ─── Role assigned to user ─────────────────────────────────────────────────────

class UserRoleAssignedParamsDto {
  @ApiProperty({ example: 'MODERATOR' }) roleName: string;
  @ApiProperty({ example: 42 }) userId: number;
}

export class UserRoleAssignedResponseDto extends MessageResponseDto {
  @ApiProperty({ type: UserRoleAssignedParamsDto })
  declare params: UserRoleAssignedParamsDto;
}

// ─── Role removed from user ────────────────────────────────────────────────────

export class UserRoleRemovedResponseDto extends MessageResponseDto {}

// ─── User deleted ──────────────────────────────────────────────────────────────

class UserDeletedParamsDto {
  @ApiProperty({ example: 42 }) userId: number;
}

export class UserDeletedResponseDto extends MessageResponseDto {
  @ApiProperty({ type: UserDeletedParamsDto })
  declare params: UserDeletedParamsDto;
}
