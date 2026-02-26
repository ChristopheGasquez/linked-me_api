import { IsEmail, IsOptional, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ResendVerificationDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: "L'email n'est pas valide" })
  email: string;

  @ApiPropertyOptional({ example: 'https://app.example.com/verify-email' })
  @IsOptional()
  @IsUrl({ require_tld: false }, { message: 'callbackUrl must be a valid URL' })
  callbackUrl?: string;
}
