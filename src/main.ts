import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { ResponseCodes } from './common/constants/response-codes.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { AuthModule } from './core/auth/auth.module.js';
import { ProfilesModule } from './core/profiles/profiles.module.js';
import { AdminModule } from './core/admin/admin.module.js';
import { AuditModule } from './core/audit/audit.module.js';
import { TasksModule } from './core/tasks/tasks.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());

  app.enableCors({
    origin: process.env.CORS_ORIGIN || true, // true = all origins allowed (dev only)
    credentials: true,
  });

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  if (process.env.SWAGGER_ENABLED === 'true') {
    // Global doc — all endpoints
    const globalConfig = new DocumentBuilder()
      .setTitle('linked-me API')
      .setDescription(
        'linked-me platform API — full documentation\n\n' +
          '## Documentation sections\n' +
          '- **[Core API](/docs/core)** — Auth, profiles, administration, audit, tasks\n' +
          '- **[Constants](/docs/constants)** — Response codes and shared constants',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const globalDocument = SwaggerModule.createDocument(app, globalConfig);
    SwaggerModule.setup('docs', app, globalDocument);

    // Core doc — auth, profiles, admin, audit, tasks
    const coreConfig = new DocumentBuilder()
      .setTitle('linked-me — Core API')
      .setDescription('Auth, profiles, administration, audit, tasks')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const coreDocument = SwaggerModule.createDocument(app, coreConfig, {
      include: [
        AuthModule,
        ProfilesModule,
        AdminModule,
        AuditModule,
        TasksModule,
      ],
    });
    SwaggerModule.setup('docs/core', app, coreDocument);

    // Constants doc — response codes and shared constants
    const constantsConfig = new DocumentBuilder()
      .setTitle('linked-me — Constants')
      .setDescription('Response codes and shared constants for client-side i18n')
      .setVersion('1.0')
      .build();
    const constantsDocument = SwaggerModule.createDocument(app, constantsConfig);
    constantsDocument.paths = {};
    constantsDocument.components = {
      schemas: {
        ResponseCodes: {
          description: 'Machine-readable response codes for client-side i18n',
          type: 'object',
          properties: Object.fromEntries(
            Object.entries(ResponseCodes).map(([key, value]) => [
              key,
              { type: 'string', example: value },
            ]),
          ),
        },
      },
    };
    SwaggerModule.setup('docs/constants', app, constantsDocument);

    // Future apps: add a new DocumentBuilder + SwaggerModule.setup('docs/<app>', ...) here
  }

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
