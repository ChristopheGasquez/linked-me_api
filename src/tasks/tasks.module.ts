import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service.js';
import { ProfilesModule } from '../profiles/profiles.module.js';

@Module({
  imports: [ProfilesModule],
  providers: [TasksService],
})
export class TasksModule {}
