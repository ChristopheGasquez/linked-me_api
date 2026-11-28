import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { Trim } from '../../../common/validators/transforms.js';
import { ApiIdProperty } from '../../../common/swagger/api-id-property.decorator.js';
import { PlanningConstants as C } from '../planning.constants.js';

// Optional free text: trimmed, blank stored as null
const TrimToNull = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  );

// PATCH: the field may be omitted, but never set to null
const IsOptionalNotNull = () =>
  ValidateIf((_: object, value: unknown) => value !== undefined);

class PlanningEventFieldsDto {
  @ApiProperty({
    example: 1,
    minimum: C.DAY_MIN,
    maximum: C.DAY_MAX,
    description:
      'ISO day (1 = Monday ... 7 = Sunday), one of the planning days',
  })
  @IsInt()
  @Min(C.DAY_MIN)
  @Max(C.DAY_MAX)
  day: number;

  @ApiProperty({
    example: 510,
    minimum: 0,
    maximum: C.MINUTES_PER_DAY - 1,
    description: 'Minutes since midnight, within the planning range',
  })
  @IsInt()
  @Min(0)
  @Max(C.MINUTES_PER_DAY - 1)
  startMinute: number;

  @ApiProperty({
    example: 990,
    minimum: 1,
    maximum: C.MINUTES_PER_DAY,
    description:
      'Minutes since midnight, after startMinute, within the planning range',
  })
  @IsInt()
  @Min(1)
  @Max(C.MINUTES_PER_DAY)
  endMinute: number;

  @ApiProperty({ example: 'École', maxLength: C.EVENT_TITLE_MAX_LENGTH })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(C.EVENT_TITLE_MAX_LENGTH)
  title: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Gymnase',
    maxLength: C.EVENT_LOCATION_MAX_LENGTH,
  })
  @TrimToNull()
  @IsOptional()
  @IsString()
  @MaxLength(C.EVENT_LOCATION_MAX_LENGTH)
  location?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Prévoir le kimono',
    maxLength: C.EVENT_DESCRIPTION_MAX_LENGTH,
  })
  @TrimToNull()
  @IsOptional()
  @IsString()
  @MaxLength(C.EVENT_DESCRIPTION_MAX_LENGTH)
  description?: string | null;
}

export class CreatePlanningEventDto extends PlanningEventFieldsDto {
  @ApiIdProperty({
    required: false,
    nullable: true,
    description:
      'Category of the same planning; null or omitted = "Non défini"',
  })
  @IsOptional()
  @IsUUID('7')
  categoryId?: string | null;
}

// Event sent with POST /plannings: its category is referenced by its index
// in the categories of the same request (ids do not exist yet)
export class InitialPlanningEventDto extends PlanningEventFieldsDto {
  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 0,
    minimum: 0,
    maximum: C.MAX_CATEGORIES_PER_PLANNING - 1,
    description:
      'Index in the categories array of the request; null or omitted = "Non défini"',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(C.MAX_CATEGORIES_PER_PLANNING - 1)
  categoryIndex?: number | null;
}

export class UpdatePlanningEventDto {
  @ApiPropertyOptional({ minimum: C.DAY_MIN, maximum: C.DAY_MAX })
  @IsOptionalNotNull()
  @IsInt()
  @Min(C.DAY_MIN)
  @Max(C.DAY_MAX)
  day?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: C.MINUTES_PER_DAY - 1 })
  @IsOptionalNotNull()
  @IsInt()
  @Min(0)
  @Max(C.MINUTES_PER_DAY - 1)
  startMinute?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: C.MINUTES_PER_DAY })
  @IsOptionalNotNull()
  @IsInt()
  @Min(1)
  @Max(C.MINUTES_PER_DAY)
  endMinute?: number;

  @ApiPropertyOptional({ maxLength: C.EVENT_TITLE_MAX_LENGTH })
  @Trim()
  @IsOptionalNotNull()
  @IsString()
  @IsNotEmpty()
  @MaxLength(C.EVENT_TITLE_MAX_LENGTH)
  title?: string;

  @ApiIdProperty({
    required: false,
    nullable: true,
    description: 'null = "Non défini"',
  })
  @IsOptional()
  @IsUUID('7')
  categoryId?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: C.EVENT_LOCATION_MAX_LENGTH,
  })
  @TrimToNull()
  @IsOptional()
  @IsString()
  @MaxLength(C.EVENT_LOCATION_MAX_LENGTH)
  location?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: C.EVENT_DESCRIPTION_MAX_LENGTH,
  })
  @TrimToNull()
  @IsOptional()
  @IsString()
  @MaxLength(C.EVENT_DESCRIPTION_MAX_LENGTH)
  description?: string | null;
}

export class PlanningEventResponseDto {
  @ApiIdProperty() id: string;
  @ApiProperty({ example: 1 }) day: number;
  @ApiProperty({ example: 510 }) startMinute: number;
  @ApiProperty({ example: 990 }) endMinute: number;
  @ApiProperty({ example: 'École' }) title: string;
  @ApiIdProperty({ nullable: true, type: String }) categoryId: string | null;
  @ApiProperty({ nullable: true, type: String, example: 'Gymnase' })
  location: string | null;
  @ApiProperty({ nullable: true, type: String, example: null })
  description: string | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}
