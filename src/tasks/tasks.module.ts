import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service.js';
import { TasksController } from './tasks.controller.js';
import { ProfilesModule } from '../profiles/profiles.module.js';

@Module({
  imports: [ProfilesModule],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
