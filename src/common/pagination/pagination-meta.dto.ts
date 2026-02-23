import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationMetaDto {
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() total: number;
  @ApiProperty() totalPages: number;
  @ApiProperty() sortBy: string;
  @ApiProperty() sortOrder: string;
  @ApiPropertyOptional() search?: string;
  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  filters?: Record<string, unknown>;
}
