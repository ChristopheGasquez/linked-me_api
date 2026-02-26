import { IsEmail, IsOptional, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: 'https://app.example.com/reset-password' })
  @IsOptional()
  @IsUrl({}, { message: 'callbackUrl must be a valid URL' })
  callbackUrl?: string;
}
