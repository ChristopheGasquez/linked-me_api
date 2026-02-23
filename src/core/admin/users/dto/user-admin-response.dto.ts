import { ApiProperty } from '@nestjs/swagger';
import { RoleBasicResponseDto } from '../../roles/dto/role-response.dto.js';

export class UserAdminResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() email: string;
  @ApiProperty() name: string;
  @ApiProperty() isEmailChecked: boolean;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
  @ApiProperty({ type: () => [RoleBasicResponseDto] })
  roles: RoleBasicResponseDto[];
}
