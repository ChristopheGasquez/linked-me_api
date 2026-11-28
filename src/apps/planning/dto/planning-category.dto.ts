import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Trim } from '../../../common/validators/transforms.js';
import { ApiIdProperty } from '../../../common/swagger/api-id-property.decorator.js';
import { PlanningConstants as C } from '../planning.constants.js';

export class CreatePlanningCategoryDto {
  @ApiProperty({ example: 'École', maxLength: C.CATEGORY_NAME_MAX_LENGTH })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(C.CATEGORY_NAME_MAX_LENGTH)
  name: string;

  @ApiProperty({
    example: 1,
    minimum: C.COLOR_MIN,
    maximum: C.COLOR_MAX,
    description: 'Hue index of the front theme palette (not a color code)',
  })
  @IsInt()
  @Min(C.COLOR_MIN)
  @Max(C.COLOR_MAX)
  color: number;
}

export class UpdatePlanningCategoryDto extends CreatePlanningCategoryDto {
  @ApiIdProperty({
    required: false,
    description: 'Existing category to update; omit to create a new one',
  })
  @IsOptional()
  @IsUUID('7')
  id?: string;
}

export class PlanningCategoryResponseDto {
  @ApiIdProperty() id: string;
  @ApiProperty({ example: 'École' }) name: string;
  @ApiProperty({ example: 1 }) color: number;
  @ApiProperty({ example: 0, description: 'Display order (0-based)' })
  position: number;
}
