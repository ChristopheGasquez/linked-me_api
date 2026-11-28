import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { ProfilesService } from './profiles.service.js';
import { AuthCookies } from '../auth/auth-cookies.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { ProfileResponseDto } from './dto/profile-response.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { Permissions } from '../auth/permissions.constants.js';
import {
  PasswordChangedResponseDto,
  ProfileDeletedResponseDto,
} from './dto/profile-success.dto.js';
import { ErrorResponseDto } from '../../common/dto/error-response.dto.js';
import { ValidationErrorResponseDto } from '../../common/dto/validation-error-response.dto.js';
import {
  ApiAuthErrors,
  ApiInvalidIdError,
  ApiOriginError,
  ApiThrottleError,
  ApiValidationError,
} from '../../common/swagger/api-common-responses.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { CachedUser } from '../auth/cache/user-cache.service.js';

@ApiTags('Profiles')
@ApiAuthErrors()
@ApiThrottleError()
@ApiOriginError()
@ApiCookieAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(Permissions.REALM_PROFILE)
@Controller('profiles')
export class ProfilesController {
  constructor(
    private profilesService: ProfilesService,
    private authCookies: AuthCookies,
  ) {}

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
  @ApiInvalidIdError()
  @RequirePermissions(Permissions.PROFILE_READ)
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe({ version: '7' })) id: string) {
    return this.profilesService.findOne(id);
  }

  @ApiOperation({ summary: 'Update your own profile' })
  @ApiResponse({
    status: 200,
    type: ProfileResponseDto,
    description: 'Profile updated',
  })
  @ApiValidationError()
  @RequirePermissions(Permissions.PROFILE_UPDATE_OWN)
  @Patch('me')
  update(@CurrentUser() user: CachedUser, @Body() dto: UpdateProfileDto) {
    return this.profilesService.update(user.id, dto);
  }

  @ApiOperation({ summary: 'Change your password' })
  @ApiResponse({
    status: 200,
    type: PasswordChangedResponseDto,
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
  async changePassword(
    @CurrentUser() user: CachedUser,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.profilesService.changePassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
    );
    this.authCookies.clear(res);
    return result;
  }

  @ApiOperation({ summary: 'Delete your own account' })
  @ApiResponse({
    status: 200,
    type: ProfileDeletedResponseDto,
    description: 'Account deleted',
  })
  @RequirePermissions(Permissions.PROFILE_DELETE_OWN)
  @Delete('me')
  async remove(
    @CurrentUser() user: CachedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.profilesService.remove(user.id);
    this.authCookies.clear(res);
    return result;
  }
}
