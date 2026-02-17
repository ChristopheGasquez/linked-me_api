import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Helmet : ajoute des headers HTTP de sécurité (X-Frame-Options, CSP, etc.)
  app.use(helmet());

  // CORS : restreint les origines autorisées à appeler l'API
  // En dev : tout est autorisé — en prod : seule l'origine définie dans CORS_ORIGIN
  app.enableCors({
    origin: process.env.CORS_ORIGIN || true,  // true = toutes les origines (dev)
    credentials: true,
  });

  // Active la validation automatique des DTOs (class-validator)
  // whitelist: true → ignore les propriétés non décorées dans le DTO
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  // Swagger : documentation de l'API, uniquement hors production
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('linked-me API')
      .setDescription('API de la plateforme linked-me')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
