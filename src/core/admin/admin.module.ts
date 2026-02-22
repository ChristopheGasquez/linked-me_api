import { Module } from '@nestjs/common';
import { AdminRolesModule } from './roles/roles.module.js';
import { AdminUsersModule } from './users/users.module.js';

@Module({
  imports: [AdminRolesModule, AdminUsersModule],
})
export class AdminModule {}
