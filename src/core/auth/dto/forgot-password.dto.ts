import { IsEmail, IsOptional, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TrimLowerCase } from '../../../common/validators/transforms.js';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @TrimLowerCase()
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: 'https://app.example.com/reset-password' })
  @IsOptional()
  @IsUrl({ require_tld: false }, { message: 'callbackUrl must be a valid URL' })
  callbackUrl?: string;
}
