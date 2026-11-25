import { ApiProperty } from '@nestjs/swagger';
import { ApiIdProperty } from '../../../common/swagger/api-id-property.decorator.js';

export class ProfileResponseDto {
  @ApiIdProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() email: string;
  @ApiProperty() createdAt: Date;
}
