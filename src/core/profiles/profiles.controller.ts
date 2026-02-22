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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { Permissions } from '../auth/permissions.constants.js';

@ApiTags('Profiles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(Permissions.REALM_PROFILE)
@Controller('profiles')
export class ProfilesController {
  constructor(private profilesService: ProfilesService) {}

  @ApiOperation({ summary: "Consulter le profil public d'un utilisateur" })
  @ApiResponse({
    status: 200,
    description: 'Profil utilisateur (id, name, email, createdAt)',
  })
  @ApiResponse({ status: 404, description: 'Utilisateur non trouvé' })
  @RequirePermissions(Permissions.PROFILE_READ)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.profilesService.findOne(id);
  }

  @ApiOperation({ summary: 'Modifier son propre profil' })
  @ApiResponse({ status: 200, description: 'Profil mis à jour' })
  @RequirePermissions(Permissions.PROFILE_UPDATE_OWN)
  @Patch('me')
  update(@Request() req: any, @Body() dto: UpdateProfileDto) {
    return this.profilesService.update(req.user.id, dto);
  }

  @ApiOperation({ summary: 'Changer son mot de passe' })
  @ApiResponse({
    status: 200,
    description: 'Mot de passe modifié, toutes les sessions révoquées',
  })
  @ApiResponse({
    status: 400,
    description: 'Nouveau mot de passe invalide (format non respecté)',
  })
  @ApiResponse({ status: 401, description: 'Mot de passe actuel incorrect' })
  @RequirePermissions(Permissions.PROFILE_UPDATE_OWN)
  @Patch('me/password')
  changePassword(@Request() req: any, @Body() dto: ChangePasswordDto) {
    return this.profilesService.changePassword(
      req.user.id,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  @ApiOperation({ summary: 'Supprimer son propre compte' })
  @ApiResponse({ status: 200, description: 'Compte supprimé' })
  @RequirePermissions(Permissions.PROFILE_DELETE_OWN)
  @Delete('me')
  remove(@Request() req: any) {
    return this.profilesService.remove(req.user.id);
  }
}
