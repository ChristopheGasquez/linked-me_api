import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Trim } from '../../../common/validators/transforms.js';
import { ApiIdProperty } from '../../../common/swagger/api-id-property.decorator.js';
import { PlanningConstants as C } from '../planning.constants.js';
import {
  CreatePlanningCategoryDto,
  PlanningCategoryResponseDto,
  UpdatePlanningCategoryDto,
} from './planning-category.dto.js';
import {
  InitialPlanningEventDto,
  PlanningEventResponseDto,
} from './planning-event.dto.js';

class PlanningFrameDto {
  @ApiProperty({ example: 'Planning Lucas', maxLength: C.NAME_MAX_LENGTH })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(C.NAME_MAX_LENGTH)
  name: string;

  @ApiProperty({
    example: 1,
    minimum: C.DAY_MIN,
    maximum: C.DAY_MAX,
    description: 'First displayed ISO day (1 = Monday ... 7 = Sunday)',
  })
  @IsInt()
  @Min(C.DAY_MIN)
  @Max(C.DAY_MAX)
  firstDay: number;

  @ApiProperty({
    example: 5,
    minimum: 1,
    maximum: C.DAY_MAX,
    description:
      'Number of consecutive days from firstDay; may wrap past Sunday (firstDay 5 + dayCount 4 = Friday to Monday)',
  })
  @IsInt()
  @Min(1)
  @Max(C.DAY_MAX)
  dayCount: number;

  @ApiProperty({
    example: 480,
    minimum: 0,
    maximum: C.MINUTES_PER_DAY - 1,
    description: 'Range start, minutes since midnight',
  })
  @IsInt()
  @Min(0)
  @Max(C.MINUTES_PER_DAY - 1)
  startMinute: number;

  @ApiProperty({
    example: 1080,
    minimum: 1,
    maximum: C.MINUTES_PER_DAY,
    description: 'Range end, minutes since midnight, after startMinute',
  })
  @IsInt()
  @Min(1)
  @Max(C.MINUTES_PER_DAY)
  endMinute: number;
}

export class CreatePlanningDto extends PlanningFrameDto {
  @ApiProperty({
    type: () => [CreatePlanningCategoryDto],
    maxItems: C.MAX_CATEGORIES_PER_PLANNING,
    description: 'Ordered categories (position = array index)',
  })
  @IsArray()
  @ArrayMaxSize(C.MAX_CATEGORIES_PER_PLANNING)
  @ValidateNested({ each: true })
  @Type(() => CreatePlanningCategoryDto)
  categories: CreatePlanningCategoryDto[];

  @ApiPropertyOptional({
    type: () => [InitialPlanningEventDto],
    maxItems: C.MAX_EVENTS_PER_PLANNING,
    description:
      'Initial events (e.g. duplication); each must fit the planning days and range',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(C.MAX_EVENTS_PER_PLANNING)
  @ValidateNested({ each: true })
  @Type(() => InitialPlanningEventDto)
  events?: InitialPlanningEventDto[];
}

export class UpdatePlanningDto extends PlanningFrameDto {
  @ApiProperty({
    type: () => [UpdatePlanningCategoryDto],
    maxItems: C.MAX_CATEGORIES_PER_PLANNING,
    description:
      'Complete ordered list: with id = update, without id = create, existing category missing = deleted (its events become "Non défini")',
  })
  @IsArray()
  @ArrayMaxSize(C.MAX_CATEGORIES_PER_PLANNING)
  @ValidateNested({ each: true })
  @Type(() => UpdatePlanningCategoryDto)
  categories: UpdatePlanningCategoryDto[];
}

export class PlanningSummaryResponseDto {
  @ApiIdProperty() id: string;
  @ApiProperty({ example: 'Planning Lucas' }) name: string;
  @ApiProperty({ example: 1 }) firstDay: number;
  @ApiProperty({ example: 5 }) dayCount: number;
  @ApiProperty({ example: 480 }) startMinute: number;
  @ApiProperty({ example: 1080 }) endMinute: number;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}

export class PlanningResponseDto extends PlanningSummaryResponseDto {
  @ApiProperty({ type: () => [PlanningCategoryResponseDto] })
  categories: PlanningCategoryResponseDto[];

  @ApiProperty({
    type: () => [PlanningEventResponseDto],
    description: 'Sorted by day then startMinute',
  })
  events: PlanningEventResponseDto[];
}
