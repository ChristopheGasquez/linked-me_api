import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getOptionsToken } from '@nestjs/throttler';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { THROTTLE } from '../../src/common/constants.js';
import { configureApp } from '../../src/configure-app.js';
import { MailService } from '../../src/core/mail/mail.service.js';
import { PrismaService } from '../../src/core/prisma/prisma.service.js';
import { FakeMailService } from './fake-mail.service.js';

export type TestApp = {
  app: INestApplication;
  /** supertest target: request(t.http) */
  http: App;
  mail: FakeMailService;
  prisma: PrismaService;
};

/**
 * Boots the full AppModule with the production configuration (configureApp),
 * mail replaced by FakeMailService and throttling disabled.
 */
export async function createTestApp(): Promise<TestApp> {
  const mail = new FakeMailService();

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MailService)
    .useValue(mail)
    // The throttler is a global APP_GUARD, which overrideGuard() can't replace:
    // override the module options instead, with the official skipIf hook
    .overrideProvider(getOptionsToken())
    .useValue({
      throttlers: [{ name: 'global', ...THROTTLE.GLOBAL }],
      skipIf: () => true,
    })
    .compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();

  return {
    app,
    http: app.getHttpServer() as App,
    mail,
    prisma: app.get(PrismaService),
  };
}
