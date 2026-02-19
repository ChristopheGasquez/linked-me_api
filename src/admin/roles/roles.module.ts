import { Module } from '@nestjs/common';
import { AdminRolesService } from './roles.service.js';
import { AdminRolesController } from './roles.controller.js';

@Module({
  controllers: [AdminRolesController],
  providers: [AdminRolesService],
})
export class AdminRolesModule {}
