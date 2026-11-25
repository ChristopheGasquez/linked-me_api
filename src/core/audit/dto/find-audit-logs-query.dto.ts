import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/pagination/index.js';
import { AuditAction } from '../audit-actions.constants.js';
import { ApiIdProperty } from '../../../common/swagger/api-id-property.decorator.js';

export class FindAuditLogsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['id', 'createdAt'], default: 'createdAt' })
  @IsOptional()
  @IsString()
  @IsIn(['id', 'createdAt'])
  sortBy: string = 'createdAt';

  @ApiPropertyOptional({
    enum: AuditAction,
    enumName: 'AuditAction',
    description: 'Filtrer par action',
  })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiIdProperty({
    required: false,
    description: 'Filtrer par acteur (id utilisateur)',
  })
  @IsOptional()
  @IsUUID('7')
  actorId?: string;

  @ApiIdProperty({ required: false, description: 'Filtrer par cible (id)' })
  @IsOptional()
  @IsUUID('7')
  targetId?: string;

  @ApiPropertyOptional({
    description: 'Filtrer par type de cible (user, role)',
  })
  @IsOptional()
  @IsString()
  targetType?: string;
}
