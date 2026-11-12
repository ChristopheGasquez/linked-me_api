import { IsString, MinLength, MaxLength, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Trim } from '../../../common/validators/transforms.js';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Jean Pierre', minLength: 2, maxLength: 100 })
  @Trim()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;
}
