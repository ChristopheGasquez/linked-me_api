import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination/index.js';

export class FindAuditLogsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['id', 'createdAt'], default: 'createdAt' })
  @IsOptional()
  @IsString()
  @IsIn(['id', 'createdAt'])
  sortBy: string = 'createdAt';

  @ApiPropertyOptional({ description: 'Filtrer par action (ex: user.delete)' })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ description: 'Filtrer par acteur (id utilisateur)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  actorId?: number;

  @ApiPropertyOptional({
    description: 'Filtrer par type de cible (user, role)',
  })
  @IsOptional()
  @IsString()
  targetType?: string;
}
