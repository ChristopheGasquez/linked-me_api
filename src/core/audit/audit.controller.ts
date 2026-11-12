import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditService } from './audit.service.js';
import { FindAuditLogsQueryDto } from './dto/find-audit-logs-query.dto.js';
import { AuditLogResponseDto } from './dto/audit-log-response.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { Permissions } from '../auth/permissions.constants.js';
import { ApiPaginatedResponse } from '../../common/pagination/index.js';
import {
  ApiAuthErrors,
  ApiThrottleError,
  ApiValidationError,
} from '../../common/swagger/api-common-responses.decorator.js';

@ApiTags('Admin — Audit')
@ApiAuthErrors()
@ApiThrottleError()
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(Permissions.REALM_AUDIT, Permissions.AUDIT_LOG_READ)
@Controller('admin/audit-logs')
export class AuditController {
  constructor(private auditService: AuditService) {}

  @ApiOperation({ summary: 'List audit logs' })
  @ApiPaginatedResponse(AuditLogResponseDto, 'Paginated list of audit logs')
  @ApiValidationError(
    'Invalid query parameter (page, limit, sortBy, sortOrder or filter) — code: validation.failed',
  )
  @Get()
  findAll(@Query() query: FindAuditLogsQueryDto) {
    return this.auditService.findAll(query);
  }
}
