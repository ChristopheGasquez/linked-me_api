import { IsEmail, IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PASSWORD_REGEX, PASSWORD_REGEX_MESSAGE } from '../../common/validators/password.constants.js';

// Un DTO définit la "forme" des données attendues
// class-validator vérifie automatiquement chaque champ
export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: "L'email n'est pas valide" })
  @MaxLength(255)
  email: string;

  @ApiProperty({ example: 'MonMotDePasse123!', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit faire au moins 8 caractères' })
  @MaxLength(255)
  @Matches(PASSWORD_REGEX, { message: PASSWORD_REGEX_MESSAGE })
  password: string;

  @ApiProperty({ example: 'Jean Dupont', minLength: 2, maxLength: 100 })
  @IsString()
  @MinLength(2, { message: 'Le nom doit faire au moins 2 caractères' })
  @MaxLength(100)
  name: string;
}
