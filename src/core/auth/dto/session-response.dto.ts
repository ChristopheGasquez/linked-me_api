import { ApiProperty } from '@nestjs/swagger';
import { ApiIdProperty } from '../../../common/swagger/api-id-property.decorator.js';

export class SessionResponseDto {
  @ApiIdProperty() id: string;
  @ApiIdProperty() userId: string;
  @ApiProperty() expiresAt: Date;
  @ApiProperty() createdAt: Date;
  @ApiProperty({ nullable: true, type: Date }) rotatedAt: Date | null;
}

export class OwnSessionResponseDto extends SessionResponseDto {
  @ApiProperty({
    description: 'True for the session of the current browser (refresh cookie)',
  })
  current: boolean;
}
