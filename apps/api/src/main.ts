import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import fastifyHelmet from '@fastify/helmet';
import fastifyCookie from '@fastify/cookie';
import { AppModule } from './app.module';
import { AppConfig } from './config/app.config';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { bufferLogs: true },
  );

  app.useLogger(app.get(Logger));

  const configService = app.get(ConfigService);
  const appConfig = configService.get<AppConfig>('app')!;

  await app.register(fastifyHelmet, {
    // The API serves JSON only; a strict default CSP would just add noise
    // without protecting anything the browser renders from this origin.
    contentSecurityPolicy: false,
  });
  await app.register(fastifyCookie);

  app.enableCors({
    origin: appConfig.corsOrigin,
    credentials: true,
  });

  app.setGlobalPrefix(appConfig.apiPrefix);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableShutdownHooks();

  await app.listen(appConfig.port, '0.0.0.0');
  app.get(Logger).log(`JARVIS API listening on port ${appConfig.port} [${appConfig.environment}]`);
}

bootstrap();
