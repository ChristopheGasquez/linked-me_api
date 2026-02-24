import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({ example: 401 }) statusCode: number;
  @ApiProperty({ example: 'Invalid credentials' }) message: string;
  @ApiProperty({ example: 'Unauthorized' }) error: string;
  @ApiPropertyOptional({ example: 'auth.login.invalid_credentials' })
  code?: string;
}
