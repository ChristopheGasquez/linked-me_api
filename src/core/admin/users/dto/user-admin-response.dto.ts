import { ApiProperty } from '@nestjs/swagger';
import { RoleBasicResponseDto } from '../../roles/dto/role-response.dto.js';
import { ApiIdProperty } from '../../../../common/swagger/api-id-property.decorator.js';

export class UserAdminResponseDto {
  @ApiIdProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty() name: string;
  @ApiProperty() isEmailChecked: boolean;
  @ApiProperty({ example: 0, description: 'Consecutive failed login attempts' })
  failedLoginAttempts: number;
  @ApiProperty({
    type: Date,
    nullable: true,
    description: 'Account locked until this date (null = not locked)',
  })
  lockedUntil: Date | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
  @ApiProperty({ type: () => [RoleBasicResponseDto] })
  roles: RoleBasicResponseDto[];
}
