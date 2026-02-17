import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Le refresh token reçu lors du login ou du dernier refresh' })
  @IsString()
  refresh_token: string;
}
