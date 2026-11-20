import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getOptionsToken } from '@nestjs/throttler';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { THROTTLE } from '../../src/common/constants.js';
import { configureApp } from '../../src/configure-app.js';
import { MailService } from '../../src/core/mail/mail.service.js';
import { PrismaService } from '../../src/core/prisma/prisma.service.js';
import { setupSwagger } from '../../src/setup-swagger.js';
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
 * `swagger: true` also mounts the Swagger docs, as main.ts does with SWAGGER_ENABLED.
 * `throttle: true` keeps the real throttler (rate limiting tests).
 */
export async function createTestApp(
  options: { swagger?: boolean; throttle?: boolean } = {},
): Promise<TestApp> {
  const mail = new FakeMailService();

  let builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MailService)
    .useValue(mail);
  if (!options.throttle) {
    // The throttler is a global APP_GUARD, which overrideGuard() can't replace:
    // override the module options instead, with the official skipIf hook
    builder = builder.overrideProvider(getOptionsToken()).useValue({
      throttlers: [{ name: 'global', ...THROTTLE.GLOBAL }],
      skipIf: () => true,
    });
  }
  const moduleRef = await builder.compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);
  if (options.swagger) setupSwagger(app);
  await app.init();

  return {
    app,
    http: app.getHttpServer() as App,
    mail,
    prisma: app.get(PrismaService),
  };
}
