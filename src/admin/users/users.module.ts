import { Module } from '@nestjs/common';
import { AdminUsersService } from './users.service.js';
import { AdminUsersController } from './users.controller.js';

@Module({
  controllers: [AdminUsersController],
  providers: [AdminUsersService],
})
export class AdminUsersModule {}
