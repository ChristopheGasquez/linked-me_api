import { ApiProperty } from '@nestjs/swagger';
import { AuditAction } from '../audit-actions.constants.js';
import { ApiIdProperty } from '../../../common/swagger/api-id-property.decorator.js';

export class AuditLogResponseDto {
  @ApiIdProperty() id: string;
  @ApiProperty({ enum: AuditAction, enumName: 'AuditAction' })
  action: AuditAction;
  @ApiIdProperty({ nullable: true, description: 'null = system (cron)' })
  actorId: string | null;
  @ApiIdProperty({ nullable: true }) targetId: string | null;
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
