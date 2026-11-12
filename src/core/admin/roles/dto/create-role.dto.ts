import { IsString, IsNotEmpty, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TrimUpperCase } from '../../../../common/validators/transforms.js';
import {
  ROLE_NAME_REGEX,
  ROLE_NAME_REGEX_MESSAGE,
} from '../../../../common/validators/role.constants.js';

export class CreateRoleDto {
  @ApiProperty({
    example: 'PREMIUM_USER',
    maxLength: 50,
    pattern: '^[A-Z][A-Z0-9_]*$',
    description: 'Normalized to uppercase',
  })
  @TrimUpperCase()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(ROLE_NAME_REGEX, { message: ROLE_NAME_REGEX_MESSAGE })
  name: string;
}
