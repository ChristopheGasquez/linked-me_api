import { Controller, Get, Patch, Delete, Param, Body, UseGuards, Request, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { Permissions } from '../auth/permissions.constants.js';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(Permissions.REALM_USER)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @ApiOperation({ summary: 'Consulter un profil par ID' })
  @ApiResponse({ status: 200, description: 'Profil utilisateur' })
  @ApiResponse({ status: 404, description: 'Utilisateur non trouvé' })
  @RequirePermissions(Permissions.USER_READ)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @ApiOperation({ summary: 'Modifier son propre profil' })
  @ApiResponse({ status: 200, description: 'Profil mis à jour' })
  @RequirePermissions(Permissions.USER_UPDATE_OWN)
  @Patch('me')
  update(@Request() req: any, @Body() dto: UpdateUserDto) {
    return this.usersService.update(req.user.id, dto);
  }

  @ApiOperation({ summary: 'Supprimer son propre compte' })
  @ApiResponse({ status: 200, description: 'Compte supprimé' })
  @RequirePermissions(Permissions.USER_DELETE_OWN)
  @Delete('me')
  remove(@Request() req: any) {
    return this.usersService.remove(req.user.id);
  }
}
