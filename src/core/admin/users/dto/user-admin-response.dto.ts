import { ApiProperty } from '@nestjs/swagger';
import { RoleBasicResponseDto } from '../../roles/dto/role-response.dto.js';

export class UserAdminResponseDto {
  @ApiProperty() id: number;
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
