import { ApiProperty } from '@nestjs/swagger';

export class AuditLogResponseDto {
  @ApiProperty() id: number;
  @ApiProperty({ example: 'user.create' }) action: string;
  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'null = system (cron)',
  })
  actorId: number | null;
  @ApiProperty({ type: Number, nullable: true }) targetId: number | null;
  @ApiProperty({ type: String, nullable: true, example: 'user' })
  targetType: string | null;
  @ApiProperty({
    nullable: true,
    type: 'object',
    additionalProperties: true,
  })
  metadata: Record<string, unknown> | null;
  @ApiProperty() createdAt: Date;
}
