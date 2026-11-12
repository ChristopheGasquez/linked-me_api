import { IsOptional, IsString, IsBoolean, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  Trim,
  TrimUpperCase,
} from '../../../../common/validators/transforms.js';
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
    description: 'Filtrer par nom de rôle (insensible à la casse)',
    example: 'ADMIN',
  })
  @TrimUpperCase()
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
  @Trim()
  @IsOptional()
  @IsString()
  search?: string;
}
