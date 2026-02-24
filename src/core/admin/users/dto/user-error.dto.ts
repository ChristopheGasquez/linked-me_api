import { ApiProperty } from '@nestjs/swagger';
import { ErrorResponseDto } from '../../../../common/dto/error-response.dto.js';

// ─── Role not found ────────────────────────────────────────────────────────────

class RoleNotFoundParamsDto {
  @ApiProperty({ example: 'MODERATOR' }) roleName: string;
}

export class RoleNotFoundErrorDto extends ErrorResponseDto {
  @ApiProperty({ type: RoleNotFoundParamsDto })
  declare params: RoleNotFoundParamsDto;
}

// ─── User role already assigned ────────────────────────────────────────────────

class UserRoleAlreadyAssignedParamsDto {
  @ApiProperty({ example: 'MODERATOR' }) roleName: string;
}

export class UserRoleAlreadyAssignedErrorDto extends ErrorResponseDto {
  @ApiProperty({ type: UserRoleAlreadyAssignedParamsDto })
  declare params: UserRoleAlreadyAssignedParamsDto;
}
