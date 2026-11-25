import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TASK_NAMES, type TaskName } from '../tasks.constants.js';
import { ApiIdProperty } from '../../../common/swagger/api-id-property.decorator.js';

class TaskScheduleDto {
  @ApiProperty({
    type: String,
    nullable: true,
    example: '0 */6 * * *',
    description: 'Cron expression, null for manual-only tasks',
  })
  cron: string | null;

  @ApiProperty({ example: true })
  automatic: boolean;
}

class TaskConfigDto {
  @ApiPropertyOptional({
    example: 24,
    description: 'unverified-users: UNVERIFIED_USER_TTL_HOURS',
  })
  ttlHours?: number;

  @ApiPropertyOptional({
    example: 30,
    description: 'audit-logs: AUDIT_LOG_TTL_DAYS',
  })
  retentionDays?: number;
}

class TaskLastRunDto {
  @ApiProperty()
  at: Date;

  @ApiIdProperty({
    nullable: true,
    description: 'Admin who ran the task, null when run by the cron',
  })
  actorId: string | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    example: { count: 5, ttlHours: 24 },
    description: 'Audit log metadata of the run',
  })
  result: Record<string, unknown> | null;
}

class TaskDto {
  @ApiProperty({ enum: TASK_NAMES, example: 'unverified-users' })
  name: TaskName;

  @ApiProperty({ example: 'task:clean-users' })
  permission: string;

  @ApiProperty({
    example: true,
    description: 'The current user holds the permission of the task',
  })
  canRun: boolean;

  @ApiProperty({ type: TaskScheduleDto })
  schedule: TaskScheduleDto;

  @ApiProperty({ type: TaskConfigDto })
  config: TaskConfigDto;

  @ApiProperty({
    type: TaskLastRunDto,
    nullable: true,
    description: 'Last run from the audit logs, null if never run',
  })
  lastRun: TaskLastRunDto | null;
}

export class TaskListResponseDto {
  @ApiProperty({ type: [TaskDto] })
  data: TaskDto[];
}
