import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../../common/pagination/index.js';

export class FindUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filtrer par nom de rôle',
    example: 'ADMIN',
  })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({
    description: 'Filtrer par statut de vérification email',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isEmailChecked?: boolean;
}
