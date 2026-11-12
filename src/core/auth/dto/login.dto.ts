import { IsEmail, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TrimLowerCase } from '../../../common/validators/transforms.js';

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @TrimLowerCase()
  @IsEmail({}, { message: "L'email n'est pas valide" })
  email: string;

  @ApiProperty({ example: 'MonMotDePasse123' })
  @IsString()
  password: string;
}
