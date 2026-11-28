import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  UserEvents,
  type UserDeletedEvent,
} from '../../common/events/user-events.js';
import { PlanningsService } from './plannings.service.js';

@Injectable()
export class PlanningUserDeletedListener {
  constructor(private planningsService: PlanningsService) {}

  // suppressErrors: false so a failed purge surfaces as an error instead of
  // leaving orphaned plannings silently
  @OnEvent(UserEvents.DELETED, { suppressErrors: false })
  handle({ userId }: UserDeletedEvent) {
    return this.planningsService.removeAllOfOwner(userId);
  }
}
