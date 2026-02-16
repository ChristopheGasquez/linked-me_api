import { IsEmail, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: "L'email n'est pas valide" })
  email: string;

  @ApiProperty({ example: 'MonMotDePasse123' })
  @IsString()
  password: string;
}
