import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
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

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  if (process.env.SWAGGER_ENABLED === 'true') {
    // Global doc — all endpoints
    const globalConfig = new DocumentBuilder()
      .setTitle('linked-me API')
      .setDescription('API de la plateforme linked-me — documentation complète')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const globalDocument = SwaggerModule.createDocument(app, globalConfig);
    SwaggerModule.setup('docs', app, globalDocument);

    // Core doc — auth, profiles, admin, audit, tasks
    const coreConfig = new DocumentBuilder()
      .setTitle('linked-me — Core API')
      .setDescription('Auth, profils, administration, audit')
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

    // Future apps: add a new DocumentBuilder + SwaggerModule.setup('docs/<app>', ...) here
  }

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
