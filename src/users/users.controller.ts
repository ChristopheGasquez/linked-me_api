import { Controller, Get, Patch, Delete, Param, Body, UseGuards, Request, ParseIntPipe } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@UseGuards(JwtAuthGuard)   // Toutes les routes de ce controller sont protégées
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  // GET /users/:id — Consulter un profil
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  // PATCH /users/me — Modifier son propre profil
  @Patch('me')
  update(@Request() req: any, @Body() dto: UpdateUserDto) {
    return this.usersService.update(req.user.id, dto);
  }

  // DELETE /users/me — Supprimer son propre compte
  @Delete('me')
  remove(@Request() req: any) {
    return this.usersService.remove(req.user.id);
  }
}
