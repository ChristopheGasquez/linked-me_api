import { ApiProperty } from '@nestjs/swagger';
import { MessageResponseDto } from '../../../../common/dto/message-response.dto.js';

// ─── Role deleted ──────────────────────────────────────────────────────────────

class RoleDeletedParamsDto {
  @ApiProperty({ example: 'MODERATOR' }) name: string;
}

export class RoleDeletedResponseDto extends MessageResponseDto {
  @ApiProperty({ type: RoleDeletedParamsDto })
  declare params: RoleDeletedParamsDto;
}

// ─── Role permission removed ───────────────────────────────────────────────────

export class RolePermissionRemovedResponseDto extends MessageResponseDto {}
