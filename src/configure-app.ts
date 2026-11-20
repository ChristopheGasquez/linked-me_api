import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { validationExceptionFactory } from './common/validators/validation-exception.factory.js';
import {
  clientIpLogger,
  parseTrustProxy,
} from './common/network/trust-proxy.js';

/**
 * Global app configuration shared by main.ts and E2E tests,
 * so tests run against the exact same pipeline as production.
 */
export function configureApp(app: INestApplication): void {
  // Behind a reverse proxy (Railway), req.ip, used as the throttler key,
  // is the proxy address unless "trust proxy" is set.
  const trustProxy = parseTrustProxy(process.env.TRUST_PROXY);
  if (trustProxy !== undefined) {
    app.getHttpAdapter().getInstance().set('trust proxy', trustProxy);
  }
  new Logger('Network').log(`trust proxy: ${trustProxy ?? 'disabled'}`);
  if (process.env.LOG_CLIENT_IP === 'true') app.use(clientIpLogger());

  app.use(helmet());

  app.enableCors({
    origin: process.env.CORS_ORIGIN || true, // true = all origins allowed (dev only)
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
