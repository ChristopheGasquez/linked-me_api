import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MessageResponseDto {
  @ApiProperty({ example: 'Operation successful' })
  message: string;

  @ApiProperty({ example: 'auth.logout.success' })
  code: string;

  @ApiPropertyOptional({ type: Object })
  params?: object;
}
