import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(currentDirectory, '..');
const require = createRequire(import.meta.url);
const tsxCli = path.join(path.dirname(require.resolve('tsx/package.json')), 'dist', 'cli.mjs');

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://scienpay_app:scienpay_dev_password_change_me@localhost:55432/scienpay_test';
const port = process.env.INTEGRATION_PORT ?? '4100';
const baseUrl = process.env.INTEGRATION_BASE_URL ?? `http://127.0.0.1:${port}/api/v1`;
const suffix =
  process.env.INTEGRATION_SUFFIX ??
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();

const env = {
  ...process.env,
  NODE_ENV: 'test',
  PORT: port,
  DATABASE_URL: databaseUrl,
  JWT_ACCESS_SECRET:
    process.env.JWT_ACCESS_SECRET ??
    'integration_access_secret_scienpay_minimum_64_characters_super_secure_key_12345',
  JWT_REFRESH_SECRET:
    process.env.JWT_REFRESH_SECRET ??
    'integration_refresh_secret_scienpay_minimum_64_characters_super_secure_key_67890',
  COOKIE_SECRET:
    process.env.COOKIE_SECRET ?? 'integration_cookie_secret_scienpay_super_secure_key_12345',
  DISABLE_LOGIN_RATE_LIMIT: 'true',
  INTEGRATION_BASE_URL: baseUrl,
  INTEGRATION_SUFFIX: suffix,
};

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: apiRoot,
    env,
    stdio: 'inherit',
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`Comando falló (${result.status}): ${command} ${args.join(' ')}`);
  }
}

function collectTests(directory) {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return collectTests(fullPath);
      return entry.isFile() && entry.name.endsWith('.test.ts') ? [fullPath] : [];
    })
    .sort();
}

async function waitForHealth(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {
      // La API aún no está lista.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('La API no respondió al health check de integración.');
}

async function main() {
  console.log(`[Integración] Base de datos: ${databaseUrl.replace(/:[^:@/]+@/, ':***@')}`);
  console.log(`[Integración] Sufijo de corrida: ${suffix}`);

  run(process.execPath, [tsxCli, 'src/infrastructure/database/migrate.ts']);
  run(process.execPath, [tsxCli, 'src/infrastructure/database/seed.ts']);

  const server = spawn(process.execPath, ['dist/main.js'], {
    cwd: apiRoot,
    env,
    stdio: 'inherit',
  });

  let exitCode = 1;
  try {
    await waitForHealth();
    const testFiles = collectTests(path.join(apiRoot, 'test', 'integration'));
    if (testFiles.length === 0) {
      throw new Error('No se encontraron tests de integración.');
    }
    const testProcess = spawn(process.execPath, [tsxCli, '--test', ...testFiles], {
      cwd: apiRoot,
      env,
      stdio: 'inherit',
    });
    exitCode = await new Promise((resolve) => testProcess.on('exit', (code) => resolve(code ?? 1)));
  } finally {
    server.kill('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (!server.killed) server.kill('SIGKILL');
  }

  process.exit(exitCode);
}

main().catch((error) => {
  console.error('[Integración] Error fatal:', error);
  process.exit(1);
});
