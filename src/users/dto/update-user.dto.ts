import { IsString, MinLength, MaxLength, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Jean Pierre', minLength: 2, maxLength: 100 })
  @IsOptional()             // Tous les champs sont optionnels (update partiel)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;
}
