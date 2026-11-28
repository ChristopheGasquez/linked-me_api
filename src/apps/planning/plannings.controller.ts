import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
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
import { ApiPaginatedResponse } from '../../common/pagination/index.js';
import {
  ApiAuthErrors,
  ApiInvalidIdError,
  ApiOriginError,
  ApiThrottleError,
  ApiValidationError,
} from '../../common/swagger/api-common-responses.decorator.js';
import { PlanningPermissions } from './planning.permissions.js';
import { PlanningsService } from './plannings.service.js';
import {
  CreatePlanningDto,
  PlanningResponseDto,
  PlanningSummaryResponseDto,
  UpdatePlanningDto,
} from './dto/planning.dto.js';
import { FindPlanningsQueryDto } from './dto/find-plannings-query.dto.js';
import { PlanningDeletedResponseDto } from './dto/planning-success.dto.js';

const NOT_FOUND = {
  status: 404,
  description:
    'Planning not found or owned by another user — code: planning.not_found',
  type: ErrorResponseDto,
};

@ApiTags('Planning')
@ApiAuthErrors()
@ApiThrottleError()
@ApiOriginError()
@ApiCookieAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(PlanningPermissions.REALM_PLANNING)
@Controller('plannings')
export class PlanningsController {
  constructor(private planningsService: PlanningsService) {}

  @ApiOperation({
    summary: 'List my plannings (without categories and events)',
  })
  @ApiPaginatedResponse(PlanningSummaryResponseDto, 'Paginated plannings')
  @ApiValidationError()
  @Get()
  findAll(
    @CurrentUser() user: CachedUser,
    @Query() query: FindPlanningsQueryDto,
  ) {
    return this.planningsService.findAll(user.id, query);
  }

  @ApiOperation({ summary: 'Get a planning with its categories and events' })
  @ApiResponse({ status: 200, type: PlanningResponseDto })
  @ApiResponse(NOT_FOUND)
  @ApiInvalidIdError()
  @Get(':id')
  findOne(
    @CurrentUser() user: CachedUser,
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
  ) {
    return this.planningsService.findOne(user.id, id);
  }

  @ApiOperation({
    summary: 'Create a planning, optionally with initial events',
    description:
      'Also used to duplicate a planning: the client sends the edited copy with its events (categoryIndex = index in categories). All or nothing.',
  })
  @ApiResponse({ status: 201, type: PlanningResponseDto })
  @ApiValidationError(
    'Validation failed (validation.failed), planning range end not after start (planning.invalid_time_range), or invalid initial event (planning.event.invalid_time_range, planning.event.outside_days, planning.event.out_of_range, planning.category.not_in_planning — params.index: index in events)',
  )
  @ApiResponse({
    status: 409,
    description:
      'Maximum number of plannings reached — code: planning.limit.plannings, params.max',
    type: ErrorResponseDto,
  })
  @Post()
  create(@CurrentUser() user: CachedUser, @Body() dto: CreatePlanningDto) {
    return this.planningsService.create(user.id, dto);
  }

  @ApiOperation({
    summary: 'Save the planning form (name, days, range, categories)',
    description:
      'Removed categories: their events become "Non défini". Removed days: their events are deleted. Reduced range: events fully outside are deleted, events partly outside are clipped to the range.',
  })
  @ApiResponse({ status: 200, type: PlanningResponseDto })
  @ApiValidationError(
    'Validation failed (validation.failed), planning range end not after start (planning.invalid_time_range), or category id not in this planning (planning.category.not_in_planning — params.index: index in categories)',
  )
  @ApiResponse(NOT_FOUND)
  @ApiInvalidIdError()
  @Put(':id')
  update(
    @CurrentUser() user: CachedUser,
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
    @Body() dto: UpdatePlanningDto,
  ) {
    return this.planningsService.update(user.id, id, dto);
  }

  @ApiOperation({ summary: 'Delete a planning with its categories and events' })
  @ApiResponse({ status: 200, type: PlanningDeletedResponseDto })
  @ApiResponse(NOT_FOUND)
  @ApiInvalidIdError()
  @Delete(':id')
  remove(
    @CurrentUser() user: CachedUser,
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
  ) {
    return this.planningsService.remove(user.id, id);
  }
}
