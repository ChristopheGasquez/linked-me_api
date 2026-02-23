import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MeResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() email: string;
  @ApiProperty() name: string;
  @ApiProperty() isEmailChecked: boolean;
  @ApiProperty() failedLoginAttempts: number;
  @ApiPropertyOptional({ nullable: true, type: String, format: 'date-time' })
  lockedUntil: Date | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
  @ApiProperty({ type: [String], example: ['USER'] }) roles: string[];
  @ApiProperty({ type: [String], example: ['realm:profile', 'profile:read'] })
  permissions: string[];
}
