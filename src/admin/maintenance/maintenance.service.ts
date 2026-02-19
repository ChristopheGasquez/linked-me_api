import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProfilesService } from '../../profiles/profiles.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Permissions } from '../../auth/permissions.constants.js';

@Injectable()
export class MaintenanceService {
  constructor(
    private profilesService: ProfilesService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  async cleanupUnverifiedUsers() {
    const ttl = +this.configService.getOrThrow<string>('UNVERIFIED_USER_TTL_HOURS');
    const count = await this.profilesService.deleteUnverified(ttl);
    return { message: `${count} compte(s) non vérifié(s) supprimé(s)` };
  }

  async cleanupOrphanedPermissions() {
    const valid = Object.values(Permissions) as string[];
    const orphaned = await this.prisma.permission.findMany({
      where: { name: { notIn: valid } },
    });

    if (orphaned.length === 0) {
      return { message: 'Aucune permission orpheline trouvée', deleted: [] };
    }

    const ids = orphaned.map((p) => p.id);
    await this.prisma.rolePermission.deleteMany({ where: { permissionId: { in: ids } } });
    await this.prisma.permission.deleteMany({ where: { id: { in: ids } } });

    return {
      message: `${orphaned.length} permission(s) orpheline(s) supprimée(s)`,
      deleted: orphaned.map((p) => p.name),
    };
  }
}
