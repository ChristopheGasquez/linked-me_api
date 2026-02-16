import { IsString, MinLength, MaxLength, IsOptional } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()             // Tous les champs sont optionnels (update partiel)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;
}
