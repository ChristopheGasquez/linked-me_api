import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { ProfilesService } from '../profiles/profiles.service.js';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private usersService: ProfilesService,
    private configService: ConfigService,
  ) {}

  @Cron('0 */6 * * *')
  async cleanupUnverifiedUsers() {
    const ttl = +this.configService.getOrThrow<string>('UNVERIFIED_USER_TTL_HOURS');
    const count = await this.usersService.deleteUnverified(ttl);
    if (count > 0) {
      this.logger.log(`Deleted ${count} unverified user(s)`);
    }
  }
}
