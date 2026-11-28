import { Module } from '@nestjs/common';
import { PlanningsController } from './plannings.controller.js';
import { PlanningEventsController } from './planning-events.controller.js';
import { PlanningsService } from './plannings.service.js';
import { PlanningEventsService } from './planning-events.service.js';
import { PlanningUserDeletedListener } from './user-deleted.listener.js';

// Planning app: depends on core only through the auth guards, the shared
// PrismaService and src/common, so it can become a separate service
@Module({
  controllers: [PlanningsController, PlanningEventsController],
  providers: [
    PlanningsService,
    PlanningEventsService,
    PlanningUserDeletedListener,
  ],
})
export class PlanningModule {}
