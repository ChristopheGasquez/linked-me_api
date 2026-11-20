import { ApiProperty } from '@nestjs/swagger';
import { MessageResponseDto } from '../../../../common/dto/message-response.dto.js';

// ─── Role deleted ──────────────────────────────────────────────────────────────

class RoleDeletedParamsDto {
  @ApiProperty({ example: 'MODERATOR' }) name: string;
}

export class RoleDeletedResponseDto extends MessageResponseDto {
  @ApiProperty({ example: 'Role deleted' })
  declare message: string;

  @ApiProperty({ example: 'admin.role.deleted' })
  declare code: string;

  @ApiProperty({ type: RoleDeletedParamsDto })
  declare params: RoleDeletedParamsDto;
}

// ─── Role permission removed ───────────────────────────────────────────────────

export class RolePermissionRemovedResponseDto extends MessageResponseDto {
  @ApiProperty({ example: 'Permission removed from role' })
  declare message: string;

  @ApiProperty({ example: 'admin.role.permission.removed' })
  declare code: string;
}
