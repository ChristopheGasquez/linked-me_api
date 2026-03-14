import { NestFactory } from '@nestjs/core';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { ResponseCodes } from './common/constants/response-codes.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { setupSwagger } from './setup-swagger.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
      exceptionFactory: (errors) => {
        const first = errors[0];
        const firstConstraint = Object.keys(first.constraints ?? {})[0];
        return new BadRequestException({
          message: first.constraints?.[firstConstraint] ?? 'Validation failed',
          code: ResponseCodes.VALIDATION_FAILED,
          params: {
            fields: errors.map((e) => {
              const constraint = Object.keys(e.constraints ?? {})[0];
              return {
                key: e.property,
                code: `validation.${e.property}.${constraint}`,
              };
            }),
          },
        });
      },
    }),
  );

  if (process.env.SWAGGER_ENABLED === 'true') setupSwagger(app);

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
