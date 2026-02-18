import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service.js';
import { UsersModule } from '../users/users.module.js';

@Module({
  imports: [UsersModule],
  providers: [TasksService],
})
export class TasksModule {}
