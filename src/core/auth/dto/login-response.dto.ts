import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiIdProperty } from '../../../common/swagger/api-id-property.decorator.js';

export class LoginUserDto {
  @ApiIdProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty() name: string;
  @ApiProperty() isEmailChecked: boolean;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}

export class TokensResponseDto {
  @ApiProperty() access_token: string;
  @ApiPropertyOptional({
    description:
      'Absent when a concurrent request already rotated the session within the last 30 s: keep the current refresh token',
  })
  refresh_token?: string;
}

export class LoginResponseDto {
  @ApiProperty() access_token: string;
  @ApiProperty() refresh_token: string;
  @ApiProperty({ type: () => LoginUserDto }) user: LoginUserDto;
}
