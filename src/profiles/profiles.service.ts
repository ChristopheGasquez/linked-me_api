import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { BCRYPT_ROUNDS, MS_PER_HOUR } from '../common/constants.js';

@Injectable()
export class ProfilesService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt };
  }

  async update(id: number, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const updated = await this.prisma.user.update({
      where: { id },
      data: dto,
    });

    await this.auditService.log('profile.update', id, id, 'user', { fields: Object.keys(dto) });

    return { id: updated.id, name: updated.name, email: updated.email, createdAt: updated.createdAt };
  }

  async remove(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    await this.prisma.user.delete({ where: { id } });
    await this.auditService.log('profile.delete', id, id, 'user', { email: user.email });
    return { message: 'Account deleted' };
  }

  async changePassword(userId: number, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) throw new UnauthorizedException('Current password is incorrect');

    const hashed = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { password: hashed } }),
      this.prisma.refreshToken.deleteMany({ where: { userId } }),
    ]);

    await this.auditService.log('profile.password.change', userId, userId, 'user');

    return { message: 'Password changed. Please log in again.' };
  }

  async deleteUnverified(ttlHours: number): Promise<number> {
    const threshold = new Date(Date.now() - ttlHours * MS_PER_HOUR);
    const result = await this.prisma.user.deleteMany({
      where: { isEmailChecked: false, createdAt: { lt: threshold } },
    });
    return result.count;
  }
}
