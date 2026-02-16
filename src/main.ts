import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Active la validation automatique des DTOs (class-validator)
  // whitelist: true → ignore les propriétés non décorées dans le DTO
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  // Configuration Swagger (documentation auto de l'API)
  const config = new DocumentBuilder()
    .setTitle('linked-me API')
    .setDescription('API de la plateforme linked-me')
    .setVersion('1.0')
    .addBearerAuth()  // Ajoute le bouton "Authorize" pour tester avec un JWT
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);  // Accessible sur /api

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
