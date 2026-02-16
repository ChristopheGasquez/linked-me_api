import { IsString, IsNotEmpty } from 'class-validator';

export class AssignRoleDto {
  @IsString()
  @IsNotEmpty()
  role: string;
}
