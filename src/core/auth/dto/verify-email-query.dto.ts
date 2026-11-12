import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyEmailQueryDto {
  @ApiProperty({ description: 'Token received by email' })
  @IsString()
  @IsNotEmpty()
  token: string;
}
