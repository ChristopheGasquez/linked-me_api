import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok' }) status: string;
  @ApiProperty({ example: '1.0.19' }) version: string;
  @ApiProperty({ example: '/docs' }) documentation: string;
}
