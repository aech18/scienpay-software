import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createApp } from './app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function bootstrap() {
  const app = await createApp();

  app.enableShutdownHooks();

  const candidatePaths = [
    path.join(__dirname, '../../web/dist'),
    path.join(__dirname, '../web/dist'),
    path.join(process.cwd(), 'apps/web/dist'),
    path.join(process.cwd(), 'web/dist'),
  ];
  const staticPath = candidatePaths.find((candidate) => fs.existsSync(candidate));

  if (staticPath) {
    app.use(express.static(staticPath));
    const server = app.getHttpAdapter().getInstance();
    server.get('*', (req: any, res: any, next: any) => {
      if (req.url.startsWith('/api')) {
        return next();
      }
      res.sendFile(path.join(staticPath, 'index.html'));
    });
    console.log(`[Scienpay API] Frontend SPA servido desde ${staticPath}`);
  }

  const port = process.env.PORT || 4000;
  await app.listen(port, '0.0.0.0');
  console.log(`[Scienpay API] Servidor ejecutándose en http://0.0.0.0:${port}/api/v1`);
}

bootstrap().catch((err) => {
  console.error('[Scienpay API] Error fatal al iniciar el servidor:', err);
  process.exit(1);
});
