import { ApiProperty } from '@nestjs/swagger';

export class LoginUserDto {
  @ApiProperty() id: number;
  @ApiProperty() email: string;
  @ApiProperty() name: string;
  @ApiProperty() isEmailChecked: boolean;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}

export class TokensResponseDto {
  @ApiProperty() access_token: string;
  @ApiProperty() refresh_token: string;
}

export class LoginResponseDto {
  @ApiProperty() access_token: string;
  @ApiProperty() refresh_token: string;
  @ApiProperty({ type: () => LoginUserDto }) user: LoginUserDto;
}
