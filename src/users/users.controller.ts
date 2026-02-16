import { Controller, Get, Patch, Delete, Param, Body, UseGuards, Request, ParseIntPipe } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { Permissions } from '../auth/permissions.constants.js';

@UseGuards(JwtAuthGuard, PermissionsGuard)  // Applique JWT + Permissions sur tout le controller
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  // GET /users/:id — Consulter un profil
  @RequirePermissions(Permissions.USER_READ)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  // PATCH /users/me — Modifier son propre profil
  @RequirePermissions(Permissions.USER_UPDATE_OWN)
  @Patch('me')
  update(@Request() req: any, @Body() dto: UpdateUserDto) {
    return this.usersService.update(req.user.id, dto);
  }

  // DELETE /users/me — Supprimer son propre compte
  @RequirePermissions(Permissions.USER_DELETE_OWN)
  @Delete('me')
  remove(@Request() req: any) {
    return this.usersService.remove(req.user.id);
  }
}
