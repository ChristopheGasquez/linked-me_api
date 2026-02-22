import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module.js';
import { AdminRolesService } from './roles.service.js';
import { AdminRolesController } from './roles.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [AdminRolesController],
  providers: [AdminRolesService],
})
export class AdminRolesModule {}
