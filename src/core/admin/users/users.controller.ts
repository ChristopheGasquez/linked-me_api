import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AdminUsersService } from './users.service.js';
import { AssignRoleDto } from './dto/assign-role.dto.js';
import { FindUsersQueryDto } from './dto/find-users-query.dto.js';
import { UserAdminResponseDto } from './dto/user-admin-response.dto.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../auth/guards/permissions.guard.js';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator.js';
import { Permissions } from '../../auth/permissions.constants.js';
import { MessageResponseDto } from '../../../common/dto/message-response.dto.js';
import { ApiPaginatedResponse } from '../../../common/pagination/index.js';

@ApiTags('Admin / Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(Permissions.REALM_ADMIN)
@Controller('admin')
export class AdminUsersController {
  constructor(private usersService: AdminUsersService) {}

  @ApiOperation({
    summary: 'Lister les utilisateurs avec pagination, tri et filtres',
  })
  @ApiPaginatedResponse(UserAdminResponseDto, 'Liste paginée des utilisateurs')
  @RequirePermissions(Permissions.ADMIN_USER_READ)
  @Get('users')
  findAllUsers(@Query() query: FindUsersQueryDto) {
    return this.usersService.findAllUsers(query);
  }

  @ApiOperation({ summary: 'Récupérer un utilisateur par son ID' })
  @ApiResponse({ status: 200, type: UserAdminResponseDto, description: 'Utilisateur trouvé' })
  @ApiResponse({ status: 404, description: 'Utilisateur non trouvé' })
  @RequirePermissions(Permissions.ADMIN_USER_READ)
  @Get('users/:id')
  findUserById(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findUserById(id);
  }

  @ApiOperation({ summary: 'Assigner un rôle à un utilisateur' })
  @ApiResponse({ status: 201, type: MessageResponseDto, description: 'Rôle assigné' })
  @ApiResponse({ status: 400, description: "L'utilisateur a déjà ce rôle" })
  @ApiResponse({ status: 404, description: 'Utilisateur ou rôle non trouvé' })
  @RequirePermissions(Permissions.ADMIN_USER_ASSIGN_ROLE)
  @Post('users/:id/roles')
  addRoleToUser(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignRoleDto,
  ) {
    return this.usersService.addRoleToUser(req.user.id, id, dto.role);
  }

  @ApiOperation({ summary: "Retirer un rôle d'un utilisateur" })
  @ApiResponse({ status: 200, type: MessageResponseDto, description: 'Rôle retiré' })
  @ApiResponse({ status: 404, description: 'Association non trouvée' })
  @RequirePermissions(Permissions.ADMIN_USER_ASSIGN_ROLE)
  @Delete('users/:id/roles/:roleId')
  removeRoleFromUser(
    @Request() req: any,
    @Param('id', ParseIntPipe) userId: number,
    @Param('roleId', ParseIntPipe) roleId: number,
  ) {
    return this.usersService.removeRoleFromUser(req.user.id, userId, roleId);
  }

  @ApiOperation({ summary: 'Supprimer un utilisateur' })
  @ApiResponse({ status: 200, type: MessageResponseDto, description: 'Utilisateur supprimé' })
  @ApiResponse({ status: 404, description: 'Utilisateur non trouvé' })
  @RequirePermissions(Permissions.ADMIN_USER_DELETE)
  @Delete('users/:id')
  deleteUser(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.usersService.deleteUser(req.user.id, id);
  }
}
