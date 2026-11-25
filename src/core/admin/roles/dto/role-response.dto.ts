import { ApiProperty } from '@nestjs/swagger';
import { ApiIdProperty } from '../../../../common/swagger/api-id-property.decorator.js';

export class PermissionResponseDto {
  @ApiIdProperty() id: string;
  @ApiProperty({ example: 'realm:profile' }) name: string;
}

export class RoleBasicResponseDto {
  @ApiIdProperty() id: string;
  @ApiProperty({ example: 'USER' }) name: string;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}

export class RoleResponseDto extends RoleBasicResponseDto {
  @ApiProperty({ type: () => [PermissionResponseDto] })
  permissions: PermissionResponseDto[];
}
