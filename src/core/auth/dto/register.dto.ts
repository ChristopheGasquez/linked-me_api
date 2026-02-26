import {
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PASSWORD_REGEX,
  PASSWORD_REGEX_MESSAGE,
} from '../../../common/validators/password.constants.js';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Invalid email' })
  @MaxLength(255)
  email: string;

  @ApiProperty({ example: 'MonMotDePasse123!', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(255)
  @Matches(PASSWORD_REGEX, { message: PASSWORD_REGEX_MESSAGE })
  password: string;

  @ApiProperty({ example: 'Jean Dupont', minLength: 2, maxLength: 100 })
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 'https://app.example.com/verify-email' })
  @IsOptional()
  @IsUrl({ require_tld: false }, { message: 'callbackUrl must be a valid URL' })
  callbackUrl?: string;
}
