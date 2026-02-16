import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  // Récupérer un utilisateur par son ID
  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  // Mettre à jour son profil
  async update(id: number, dto: UpdateUserDto) {
    // Vérifie que l'utilisateur existe
    await this.findOne(id);

    const user = await this.prisma.user.update({
      where: { id },
      data: dto,
    });

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  // Supprimer son compte
  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.user.delete({ where: { id } });
    return { message: 'Compte supprimé' };
  }
}
