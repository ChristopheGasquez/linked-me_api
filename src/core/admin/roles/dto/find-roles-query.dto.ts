import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../../common/pagination/index.js';

export class FindRolesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: ['id', 'name', 'createdAt', 'updatedAt'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsString()
  @IsIn(['id', 'name', 'createdAt', 'updatedAt'])
  sortBy: string = 'createdAt';
}
