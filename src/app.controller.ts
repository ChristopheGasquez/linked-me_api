import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service.js';
import { HealthResponseDto } from './common/dto/health-response.dto.js';
import {
  ApiOriginError,
  ApiThrottleError,
} from './common/swagger/api-common-responses.decorator.js';

@ApiTags('Health')
@ApiThrottleError()
@ApiOriginError()
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @ApiOperation({ summary: 'Health check: API status and version' })
  @ApiResponse({
    status: 200,
    type: HealthResponseDto,
    description: 'API is up',
  })
  @Get()
  getHealth(): HealthResponseDto {
    return this.appService.getHealth();
  }
}
