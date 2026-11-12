import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Trim } from '../../../../common/validators/transforms.js';
import { PaginationQueryDto } from '../../../../common/pagination/index.js';

export class FindPermissionsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['id', 'name'], default: 'name' })
  @IsOptional()
  @IsString()
  @IsIn(['id', 'name'])
  sortBy: string = 'name';

  @ApiPropertyOptional()
  @Trim()
  @IsOptional()
  @IsString()
  search?: string;
}
