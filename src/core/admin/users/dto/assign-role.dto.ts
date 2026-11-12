import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TrimUpperCase } from '../../../../common/validators/transforms.js';

export class AssignRoleDto {
  @ApiProperty({ example: 'ADMIN', description: 'Case-insensitive' })
  @TrimUpperCase()
  @IsString()
  @IsNotEmpty()
  role: string;
}
