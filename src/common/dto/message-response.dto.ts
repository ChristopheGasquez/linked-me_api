import { ApiProperty } from '@nestjs/swagger';

export class MessageResponseDto {
  @ApiProperty({ example: 'Operation successful' })
  message: string;

  @ApiProperty({ example: 'auth.logout.success' })
  code: string;
}
