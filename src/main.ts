import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './configure-app.js';
import { setupSwagger } from './setup-swagger.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  configureApp(app);

  if (process.env.SWAGGER_ENABLED === 'true') setupSwagger(app);

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
