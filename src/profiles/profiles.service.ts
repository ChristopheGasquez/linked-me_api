import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';

@Injectable()
export class ProfilesService {
  constructor(private prisma: PrismaService) {}

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    return { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt };
  }

  async update(id: number, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur non trouvé');

    const updated = await this.prisma.user.update({
      where: { id },
      data: dto,
    });

    return { id: updated.id, name: updated.name, email: updated.email, createdAt: updated.createdAt };
  }

  async remove(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur non trouvé');
    await this.prisma.user.delete({ where: { id } });
    return { message: 'Compte supprimé' };
  }

  async deleteUnverified(ttlHours: number): Promise<number> {
    const threshold = new Date(Date.now() - ttlHours * 60 * 60 * 1000);
    const result = await this.prisma.user.deleteMany({
      where: { isEmailChecked: false, createdAt: { lt: threshold } },
    });
    return result.count;
  }
}
