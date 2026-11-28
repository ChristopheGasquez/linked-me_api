import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PlanningResponseCodes as Codes } from './planning.response-codes.js';

const MESSAGES: Record<string, string> = {
  [Codes.PLANNING_NOT_FOUND]: 'Planning not found',
  [Codes.PLANNING_INVALID_TIME_RANGE]:
    'Planning range end must be after its start',
  [Codes.PLANNING_EVENT_NOT_FOUND]: 'Event not found',
  [Codes.PLANNING_EVENT_INVALID_TIME_RANGE]:
    'Event end must be after its start',
  [Codes.PLANNING_EVENT_OUT_OF_RANGE]:
    'Event is outside the planning time range',
  [Codes.PLANNING_EVENT_OUTSIDE_DAYS]: 'Event day is outside the planning days',
  [Codes.PLANNING_CATEGORY_NOT_IN_PLANNING]:
    'Category does not belong to this planning',
  [Codes.PLANNING_LIMIT_PLANNINGS]: 'Maximum number of plannings reached',
  [Codes.PLANNING_LIMIT_EVENTS]: 'Maximum number of events reached',
};

const body = (code: string, params?: object) => ({
  message: MESSAGES[code],
  code,
  ...(params && { params }),
});

export const planningNotFound = () =>
  new NotFoundException(body(Codes.PLANNING_NOT_FOUND));

export const eventNotFound = () =>
  new NotFoundException(body(Codes.PLANNING_EVENT_NOT_FOUND));

export const planningBadRequest = (code: string, params?: object) =>
  new BadRequestException(body(code, params));

export const planningConflict = (code: string, params?: object) =>
  new ConflictException(body(code, params));
