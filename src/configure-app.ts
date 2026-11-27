import { INestApplication, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { validationExceptionFactory } from './common/validators/validation-exception.factory.js';
import { getAllowedOrigins } from './common/origins/allowed-origins.js';

/**
 * Global app configuration shared by main.ts and E2E tests,
 * so tests run against the exact same pipeline as production.
 */
export function configureApp(app: INestApplication): void {
  app.use(helmet());
  app.use(cookieParser());

  app.enableCors({
    origin: getAllowedOrigins().all,
    credentials: true,
  });

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );
}
