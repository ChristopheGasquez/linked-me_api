import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/pagination/index.js';

export class FindSessionsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: ['id', 'createdAt', 'expiresAt'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsString()
  @IsIn(['id', 'createdAt', 'expiresAt'])
  sortBy: string = 'createdAt';
}
