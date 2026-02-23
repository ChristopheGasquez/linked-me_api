import { ApiProperty } from '@nestjs/swagger';

export class SessionResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() userId: number;
  @ApiProperty() expiresAt: Date;
  @ApiProperty() createdAt: Date;
}
