import { Module } from '@nestjs/common';
import { AdminRolesModule } from './roles/roles.module.js';
import { AdminUsersModule } from './users/users.module.js';
import { MaintenanceModule } from './maintenance/maintenance.module.js';

@Module({
  imports: [AdminRolesModule, AdminUsersModule, MaintenanceModule],
})
export class AdminModule {}
