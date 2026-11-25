import { ApiProperty, type ApiPropertyOptions } from '@nestjs/swagger';

export const UUID_V7_EXAMPLE = '019ab8f2-6c3e-7d41-9b2a-5e8c1f3a7d90';

export const ApiIdProperty = (options: ApiPropertyOptions = {}) =>
  ApiProperty({
    type: String,
    format: 'uuid',
    example: UUID_V7_EXAMPLE,
    ...options,
  } as ApiPropertyOptions);
