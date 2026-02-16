import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

// Un DTO définit la "forme" des données attendues
// class-validator vérifie automatiquement chaque champ
export class RegisterDto {
  @IsEmail({}, { message: "L'email n'est pas valide" })
  @MaxLength(255)
  email: string;

  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit faire au moins 8 caractères' })
  @MaxLength(255)
  password: string;

  @IsString()
  @MinLength(2, { message: 'Le nom doit faire au moins 2 caractères' })
  @MaxLength(100)
  name: string;
}
