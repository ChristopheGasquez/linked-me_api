import { ApiProperty } from '@nestjs/swagger';
import { MessageResponseDto } from '../../../common/dto/message-response.dto.js';

export class PlanningDeletedResponseDto extends MessageResponseDto {
  @ApiProperty({ example: 'Planning deleted' })
  declare message: string;

  @ApiProperty({ example: 'planning.deleted' })
  declare code: string;
}

export class PlanningClearedResponseDto extends MessageResponseDto {
  @ApiProperty({ example: 'Planning cleared' })
  declare message: string;

  @ApiProperty({ example: 'planning.cleared' })
  declare code: string;

  @ApiProperty({
    example: { count: 12 },
    description: 'count = number of deleted events',
  })
  declare params: { count: number };
}

export class PlanningEventDeletedResponseDto extends MessageResponseDto {
  @ApiProperty({ example: 'Event deleted' })
  declare message: string;

  @ApiProperty({ example: 'planning.event.deleted' })
  declare code: string;
}
