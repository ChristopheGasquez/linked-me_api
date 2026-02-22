import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './core/prisma/prisma.module.js';
import { AuthModule } from './core/auth/auth.module.js';
import { ProfilesModule } from './core/profiles/profiles.module.js';
import { AdminModule } from './core/admin/admin.module.js';
import { MailModule } from './core/mail/mail.module.js';
import { TasksModule } from './core/tasks/tasks.module.js';
import { AuditModule } from './core/audit/audit.module.js';
import { THROTTLE } from './common/constants.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ name: 'global', ...THROTTLE.GLOBAL }]),
    PrismaModule,
    MailModule,
    AuthModule,
    ProfilesModule,
    AdminModule,
    TasksModule,
    AuditModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
