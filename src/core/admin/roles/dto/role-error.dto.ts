import { ApiProperty } from '@nestjs/swagger';
import { ErrorResponseDto } from '../../../../common/dto/error-response.dto.js';

// ─── Role already exists ───────────────────────────────────────────────────────

class RoleAlreadyExistsParamsDto {
  @ApiProperty({ example: 'MODERATOR' }) name: string;
}

export class RoleAlreadyExistsErrorDto extends ErrorResponseDto {
  @ApiProperty({ type: RoleAlreadyExistsParamsDto })
  declare params: RoleAlreadyExistsParamsDto;
}

// ─── Role has users ────────────────────────────────────────────────────────────

class RoleHasUsersParamsDto {
  @ApiProperty({ example: 3 }) count: number;
}

export class RoleHasUsersErrorDto extends ErrorResponseDto {
  @ApiProperty({ type: RoleHasUsersParamsDto })
  declare params: RoleHasUsersParamsDto;
}

// ─── Unknown permissions ───────────────────────────────────────────────────────

class UnknownPermissionsParamsDto {
  @ApiProperty({ type: [String], example: ['obsolete:permission'] })
  permissions: string[];
}

export class UnknownPermissionsErrorDto extends ErrorResponseDto {
  @ApiProperty({ type: UnknownPermissionsParamsDto })
  declare params: UnknownPermissionsParamsDto;
}
