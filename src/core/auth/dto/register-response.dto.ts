import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiIdProperty } from '../../../common/swagger/api-id-property.decorator.js';

export class RegisterResponseDto {
  @ApiIdProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty() name: string;
  @ApiProperty() isEmailChecked: boolean;
  @ApiProperty() failedLoginAttempts: number;
  @ApiPropertyOptional({ nullable: true, type: String, format: 'date-time' })
  lockedUntil: Date | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}
