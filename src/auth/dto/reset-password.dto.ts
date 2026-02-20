import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ example: 'a3f2c1d4e5b6...' })
  @IsString()
  token: string;

  @ApiProperty({ example: 'NewPassword123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;
}
