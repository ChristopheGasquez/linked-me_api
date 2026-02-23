import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuditLogResponseDto {
  @ApiProperty() id: number;
  @ApiProperty({ example: 'user.create' }) action: string;
  @ApiPropertyOptional({ nullable: true }) actorId: number | null;
  @ApiPropertyOptional({ nullable: true }) targetId: number | null;
  @ApiPropertyOptional({ nullable: true, example: 'user' })
  targetType: string | null;
  @ApiPropertyOptional({ nullable: true, type: 'object', additionalProperties: true })
  metadata: Record<string, unknown> | null;
  @ApiProperty() createdAt: Date;
}
