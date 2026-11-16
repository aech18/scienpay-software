export const BASE_URL = process.env.INTEGRATION_BASE_URL ?? 'http://127.0.0.1:4100/api/v1';

export const RUN_SUFFIX = process.env.INTEGRATION_SUFFIX ?? Date.now().toString(36).toUpperCase();

export const ADMIN = { identifier: 'admin', password: 'Admin#Scienpay2026!' };
export const GENERADOR = { identifier: 'generador', password: 'Coord#Scienpay2026!' };
export const RECEPTOR = { identifier: 'receptor', password: 'Finan#Scienpay2026!' };

export interface LoginResult {
  accessToken: string;
  refreshCookie?: string;
  user: { id: string; role: string; email: string; fullName: string };
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  token?: string;
  body?: unknown;
  cookie?: string;
  expected?: number | number[];
  raw?: boolean;
}

export async function api<T = any>(path: string, options: ApiOptions = {}): Promise<T> {
  const expected = Array.isArray(options.expected) ? options.expected : [options.expected ?? 200];
  const headers = new Headers();
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);
  if (options.cookie) headers.set('Cookie', options.cookie);

  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!expected.includes(response.status)) {
    const text = await response.text();
    throw new Error(
      `HTTP ${response.status} en ${options.method ?? 'GET'} ${path}; esperado ${expected.join(
        '/',
      )}. Cuerpo: ${text.slice(0, 500)}`,
    );
  }

  if (options.raw) return response as unknown as T;

  const text = await response.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

export async function login(credentials = ADMIN): Promise<LoginResult> {
  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  const text = await response.text();
  if (response.status !== 200) {
    throw new Error(`Login falló (${response.status}): ${text}`);
  }
  const payload = JSON.parse(text) as { accessToken: string; user: LoginResult['user'] };
  return {
    accessToken: payload.accessToken,
    user: payload.user,
    refreshCookie: response.headers.get('set-cookie')?.split(';')[0],
  };
}

export function extractCookie(response: Response): string | undefined {
  return response.headers.get('set-cookie')?.split(';')[0];
}

export function uniqueCode(prefix: string): string {
  const value = `${prefix}${RUN_SUFFIX}`.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  return value.slice(0, 20);
}

export function uniqueDocument(prefix: string): string {
  return `${prefix}${RUN_SUFFIX}`.slice(0, 30);
}

export async function waitForHealth(timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/health`);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`La API no respondió en ${timeoutMs} ms: ${String(lastError)}`);
}
