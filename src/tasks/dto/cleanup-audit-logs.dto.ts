import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class CleanupAuditLogsDto {
  @ApiProperty({ description: 'Supprimer les logs plus vieux que N jours', minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  olderThanDays: number;
}
