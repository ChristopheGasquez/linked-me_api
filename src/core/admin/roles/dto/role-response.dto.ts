import { ApiProperty } from '@nestjs/swagger';

export class PermissionResponseDto {
  @ApiProperty() id: number;
  @ApiProperty({ example: 'realm:profile' }) name: string;
}

export class RoleBasicResponseDto {
  @ApiProperty() id: number;
  @ApiProperty({ example: 'USER' }) name: string;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}

export class RoleResponseDto extends RoleBasicResponseDto {
  @ApiProperty({ type: () => [PermissionResponseDto] })
  permissions: PermissionResponseDto[];
}
