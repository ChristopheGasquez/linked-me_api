import { ApiProperty } from '@nestjs/swagger';
import { ApiIdProperty } from '../../../common/swagger/api-id-property.decorator.js';

export class LoginUserDto {
  @ApiIdProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty() name: string;
  @ApiProperty() isEmailChecked: boolean;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}

export class LoginResponseDto {
  @ApiProperty({ type: () => LoginUserDto }) user: LoginUserDto;
}
