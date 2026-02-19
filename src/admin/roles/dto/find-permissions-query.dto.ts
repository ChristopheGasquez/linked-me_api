import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/pagination/index.js';

export class FindPermissionsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['id', 'name'], default: 'name' })
  @IsOptional()
  @IsString()
  @IsIn(['id', 'name'])
  sortBy: string = 'name';
}
