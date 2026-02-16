import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: "L'email n'est pas valide" })
  email: string;

  @IsString()
  password: string;
}
