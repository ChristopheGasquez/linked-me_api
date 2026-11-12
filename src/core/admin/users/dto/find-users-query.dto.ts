import { IsOptional, IsString, IsBoolean, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../../common/pagination/index.js';

export class FindUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: ['id', 'email', 'name', 'createdAt', 'updatedAt'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsString()
  @IsIn(['id', 'email', 'name', 'createdAt', 'updatedAt'])
  sortBy: string = 'createdAt';

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
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  isEmailChecked?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
