import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { AppModule } from './app.module.js';
import { ApiExceptionFilter } from './common/api-exception.filter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const origins = config.get<string>('CORS_ORIGINS', '').split(',').map((item) => item.trim()).filter(Boolean);

  app.use(pinoHttp({
    genReqId: (_req, res) => {
      const requestId = randomUUID();
      res.setHeader('x-request-id', requestId);
      return requestId;
    },
    redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers.set-cookie'],
    serializers: { req: (req) => ({ id: req.id, method: req.method, url: req.url?.split('?')[0] }) },
    customLogLevel: (_req, res, error) => error || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
  }));
  app.use(helmet());
  app.enableCors({
    origin: (origin: string | undefined, callback: (error: Error | null, allowed?: boolean) => void) => callback(null, !origin || origins.includes(origin)),
    credentials: false,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();

  if (config.get<boolean>('SWAGGER_ENABLED') && config.get<string>('APP_ENV') !== 'production') {
    const { SwaggerModule, DocumentBuilder } = await import('@nestjs/swagger');
    const document = SwaggerModule.createDocument(app, new DocumentBuilder()
      .setTitle('MedKnot API')
      .setDescription('Version 1 patient API and local backend foundation.')
      .setVersion('1.0')
      .addBearerAuth()
      .build());
    SwaggerModule.setup('docs', app, document, { useGlobalPrefix: true, jsonDocumentUrl: 'openapi.json' });
  }

  const port = config.get<number>('PORT', 4000);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
