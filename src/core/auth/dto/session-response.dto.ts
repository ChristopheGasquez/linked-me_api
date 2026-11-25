import { ApiProperty } from '@nestjs/swagger';
import { ApiIdProperty } from '../../../common/swagger/api-id-property.decorator.js';

export class SessionResponseDto {
  @ApiIdProperty() id: string;
  @ApiIdProperty() userId: string;
  @ApiProperty() expiresAt: Date;
  @ApiProperty() createdAt: Date;
}
