import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import fastifyHelmet from '@fastify/helmet';
import fastifyCookie from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import { AppModule } from './app.module';
import { AppConfig } from './config/app.config';
import { RagConfig } from './config/rag.config';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());

  const configService = app.get(ConfigService);
  const appConfig = configService.get<AppConfig>('app')!;
  const ragConfig = configService.get<RagConfig>('rag')!;

  await app.register(fastifyHelmet, {
    // The API serves JSON only; a strict default CSP would just add noise
    // without protecting anything the browser renders from this origin.
    contentSecurityPolicy: false,
  });
  await app.register(fastifyCookie);
  // Knowledge base uploads (Step 11) - the size cap is the one thing that
  // must live here rather than in DocumentsService, since Fastify enforces
  // it while streaming the upload, before a handler ever sees the bytes.
  await app.register(fastifyMultipart, {
    limits: { fileSize: ragConfig.maxUploadBytes, files: 1 },
  });

  // Replaces the per-request access-log line pino-http used to print
  // automatically before it was swapped out for Nest's plain Logger -
  // Fastify's onResponse hook fires for every request/response regardless
  // of how the route handler responds, and reply.elapsedTime is timed by
  // Fastify itself rather than hand-rolled with Date.now().
  const httpLogger = new Logger('HTTP');
  app.getHttpAdapter().getInstance().addHook('onResponse', (request, reply, done) => {
    httpLogger.log(`${request.method} ${request.url} ${reply.statusCode} +${reply.elapsedTime.toFixed(0)}ms`);
    done();
  });

  app.enableCors({
    origin: appConfig.corsOrigin,
    credentials: true,
    // @fastify/cors defaults `methods` to 'GET,HEAD,POST' - every PATCH/DELETE
    // endpoint (renaming/archiving/deleting conversations, memories,
    // documents, ...) was silently CORS-blocked from the browser without
    // this, even though curl (no Origin header, no preflight) never showed it.
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE'],
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
  new Logger('Bootstrap').log(`FRIDAY API listening on port ${appConfig.port} [${appConfig.environment}]`);
}

bootstrap();
