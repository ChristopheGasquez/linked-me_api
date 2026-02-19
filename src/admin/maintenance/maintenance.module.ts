import { Module } from '@nestjs/common';
import { MaintenanceService } from './maintenance.service.js';
import { MaintenanceController } from './maintenance.controller.js';
import { ProfilesModule } from '../../profiles/profiles.module.js';

@Module({
  imports: [ProfilesModule],
  controllers: [MaintenanceController],
  providers: [MaintenanceService],
})
export class MaintenanceModule {}
