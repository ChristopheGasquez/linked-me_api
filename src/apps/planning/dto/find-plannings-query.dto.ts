import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/pagination/index.js';

export class FindPlanningsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: ['createdAt', 'updatedAt', 'name'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsString()
  @IsIn(['createdAt', 'updatedAt', 'name'])
  sortBy: string = 'createdAt';
}
