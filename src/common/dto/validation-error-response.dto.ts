import { ApiProperty } from '@nestjs/swagger';

class ValidationFieldDto {
  @ApiProperty({ example: 'password' }) key: string;
  @ApiProperty({ example: 'validation.password.matches' }) code: string;
}

class ValidationParamsDto {
  @ApiProperty({ type: [ValidationFieldDto] }) fields: ValidationFieldDto[];
}

export class ValidationErrorResponseDto {
  @ApiProperty({ example: 400 }) statusCode: number;
  @ApiProperty({ example: 'BAD_REQUEST' }) error: string;
  @ApiProperty({
    example:
      'Password must contain at least one uppercase letter, one number and one special character',
  })
  message: string;
  @ApiProperty({ example: 'validation.failed' }) code: string;
  @ApiProperty({ type: ValidationParamsDto }) params: ValidationParamsDto;
}
