import { ApiProperty } from '@nestjs/swagger';
import { MessageResponseDto } from '../../../common/dto/message-response.dto.js';

// ─── Password changed ──────────────────────────────────────────────────────────

export class PasswordChangedResponseDto extends MessageResponseDto {
  @ApiProperty({ example: 'Password changed. Please log in again.' })
  declare message: string;

  @ApiProperty({ example: 'profile.password.changed' })
  declare code: string;
}

// ─── Profile deleted ───────────────────────────────────────────────────────────

export class ProfileDeletedResponseDto extends MessageResponseDto {
  @ApiProperty({ example: 'Account deleted' })
  declare message: string;

  @ApiProperty({ example: 'profile.deleted' })
  declare code: string;
}
