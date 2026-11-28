import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../core/auth/guards/permissions.guard.js';
import { RequirePermissions } from '../../core/auth/decorators/permissions.decorator.js';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator.js';
import type { CachedUser } from '../../core/auth/cache/user-cache.service.js';
import { ErrorResponseDto } from '../../common/dto/error-response.dto.js';
import {
  ApiAuthErrors,
  ApiInvalidIdError,
  ApiOriginError,
  ApiThrottleError,
  ApiValidationError,
} from '../../common/swagger/api-common-responses.decorator.js';
import { PlanningPermissions } from './planning.permissions.js';
import { PlanningEventsService } from './planning-events.service.js';
import {
  CreatePlanningEventDto,
  PlanningEventResponseDto,
  UpdatePlanningEventDto,
} from './dto/planning-event.dto.js';
import {
  PlanningClearedResponseDto,
  PlanningEventDeletedResponseDto,
} from './dto/planning-success.dto.js';

const PLANNING_NOT_FOUND = {
  status: 404,
  description:
    'Planning not found or owned by another user — code: planning.not_found',
  type: ErrorResponseDto,
};

const EVENT_NOT_FOUND = {
  status: 404,
  description:
    'Planning not found (planning.not_found) or event not found in this planning (planning.event.not_found)',
  type: ErrorResponseDto,
};

const EVENT_RULES =
  'Validation failed (validation.failed), end not after start (planning.event.invalid_time_range), day outside the planning days (planning.event.outside_days), outside the planning range (planning.event.out_of_range), or category of another planning (planning.category.not_in_planning)';

@ApiTags('Planning')
@ApiAuthErrors()
@ApiThrottleError()
@ApiOriginError()
@ApiCookieAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(PlanningPermissions.REALM_PLANNING)
@Controller('plannings/:id/events')
export class PlanningEventsController {
  constructor(private eventsService: PlanningEventsService) {}

  @ApiOperation({ summary: 'Create an event' })
  @ApiResponse({ status: 201, type: PlanningEventResponseDto })
  @ApiValidationError(EVENT_RULES)
  @ApiResponse(PLANNING_NOT_FOUND)
  @ApiResponse({
    status: 409,
    description:
      'Maximum number of events reached — code: planning.limit.events, params.max',
    type: ErrorResponseDto,
  })
  @ApiInvalidIdError()
  @Post()
  create(
    @CurrentUser() user: CachedUser,
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
    @Body() dto: CreatePlanningEventDto,
  ) {
    return this.eventsService.create(user.id, id, dto);
  }

  @ApiOperation({
    summary: 'Update or move an event',
    description:
      'Partial update; the resulting event is checked against the planning rules.',
  })
  @ApiResponse({ status: 200, type: PlanningEventResponseDto })
  @ApiValidationError(EVENT_RULES)
  @ApiResponse(EVENT_NOT_FOUND)
  @ApiInvalidIdError()
  @Patch(':eventId')
  update(
    @CurrentUser() user: CachedUser,
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
    @Param('eventId', new ParseUUIDPipe({ version: '7' })) eventId: string,
    @Body() dto: UpdatePlanningEventDto,
  ) {
    return this.eventsService.update(user.id, id, eventId, dto);
  }

  @ApiOperation({ summary: 'Delete an event' })
  @ApiResponse({ status: 200, type: PlanningEventDeletedResponseDto })
  @ApiResponse(EVENT_NOT_FOUND)
  @ApiInvalidIdError()
  @Delete(':eventId')
  remove(
    @CurrentUser() user: CachedUser,
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
    @Param('eventId', new ParseUUIDPipe({ version: '7' })) eventId: string,
  ) {
    return this.eventsService.remove(user.id, id, eventId);
  }

  @ApiOperation({
    summary: 'Clear a planning',
    description:
      'Deletes all its events; name, days, range and categories are kept.',
  })
  @ApiResponse({ status: 200, type: PlanningClearedResponseDto })
  @ApiResponse(PLANNING_NOT_FOUND)
  @ApiInvalidIdError()
  @Delete()
  clear(
    @CurrentUser() user: CachedUser,
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
  ) {
    return this.eventsService.clear(user.id, id);
  }
}
