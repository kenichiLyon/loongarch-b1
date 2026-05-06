import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  registerWebDist(app);

  const port = Number(process.env.API_PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
}

function registerWebDist(app: NestExpressApplication) {
  const webDistDir = path.resolve(process.env.WEB_DIST_DIR?.trim() || path.join(process.cwd(), 'apps', 'web', 'dist'));
  const indexHtml = path.join(webDistDir, 'index.html');
  if (!existsSync(indexHtml)) {
    return;
  }

  const instance = app.getHttpAdapter().getInstance() as {
    get: (path: string, handler: (_request: unknown, response: { sendFile: (filePath: string) => void }) => void) => void;
  };
  app.useStaticAssets(webDistDir, { index: false, fallthrough: true });
  instance.get('/', (_request: unknown, response: { sendFile: (filePath: string) => void }) => {
    response.sendFile(indexHtml);
  });
}

void bootstrap();
