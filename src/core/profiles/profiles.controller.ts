import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ProfilesService } from './profiles.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { ProfileResponseDto } from './dto/profile-response.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { Permissions } from '../auth/permissions.constants.js';
import { MessageResponseDto } from '../../common/dto/message-response.dto.js';
import { ErrorResponseDto } from '../../common/dto/error-response.dto.js';
import { ValidationErrorResponseDto } from '../../common/dto/validation-error-response.dto.js';

@ApiTags('Profiles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(Permissions.REALM_PROFILE)
@Controller('profiles')
export class ProfilesController {
  constructor(private profilesService: ProfilesService) {}

  @ApiOperation({ summary: 'Get the public profile of a user' })
  @ApiResponse({
    status: 200,
    type: ProfileResponseDto,
    description: 'User profile (id, name, email, createdAt)',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
    type: ErrorResponseDto,
  })
  @RequirePermissions(Permissions.PROFILE_READ)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.profilesService.findOne(id);
  }

  @ApiOperation({ summary: 'Update your own profile' })
  @ApiResponse({
    status: 200,
    type: ProfileResponseDto,
    description: 'Profile updated',
  })
  @RequirePermissions(Permissions.PROFILE_UPDATE_OWN)
  @Patch('me')
  update(@Request() req: any, @Body() dto: UpdateProfileDto) {
    return this.profilesService.update(req.user.id, dto);
  }

  @ApiOperation({ summary: 'Change your password' })
  @ApiResponse({
    status: 200,
    type: MessageResponseDto,
    description: 'Password changed, all sessions revoked',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed (password format)',
    type: ValidationErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Current password incorrect',
    type: ErrorResponseDto,
  })
  @RequirePermissions(Permissions.PROFILE_UPDATE_OWN)
  @Patch('me/password')
  changePassword(@Request() req: any, @Body() dto: ChangePasswordDto) {
    return this.profilesService.changePassword(
      req.user.id,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  @ApiOperation({ summary: 'Delete your own account' })
  @ApiResponse({
    status: 200,
    type: MessageResponseDto,
    description: 'Account deleted',
  })
  @RequirePermissions(Permissions.PROFILE_DELETE_OWN)
  @Delete('me')
  remove(@Request() req: any) {
    return this.profilesService.remove(req.user.id);
  }
}
