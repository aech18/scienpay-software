import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIN,
  GENERADOR,
  RECEPTOR,
  api,
  login,
  waitForHealth,
} from '../helpers/integration-env.js';

describe('Integración: salud y autenticación', () => {
  it('responde health', async () => {
    await waitForHealth();
    const health = await api<{ status: string }>('/health');
    assert.ok(health.status);
  });

  it('inicia sesión con los tres roles y devuelve el perfil', async () => {
    for (const credentials of [ADMIN, GENERADOR, RECEPTOR]) {
      const session = await login(credentials);
      assert.ok(session.accessToken);
      assert.ok(session.refreshCookie);
      const me = await api<{ email: string; role: string }>('/auth/me', {
        token: session.accessToken,
      });
      assert.equal(me.email, session.user.email);
      assert.equal(me.role, session.user.role);
    }
  });

  it('rechaza credenciales inválidas sin filtrar el motivo', async () => {
    const response = await api<{ message: string }>('/auth/login', {
      method: 'POST',
      body: { identifier: 'usuario.inexistente', password: 'Incorrecta#2026' },
      expected: 401,
    });
    assert.match(String(response.message), /CREDENCIALES_INVALIDAS/);
  });

  it('rota el refresh token y revoca la cookie al cerrar sesión', async () => {
    const session = await login(ADMIN);
    const refreshed = await api<{ accessToken: string }>('/auth/refresh', {
      method: 'POST',
      cookie: session.refreshCookie,
    });
    assert.ok(refreshed.accessToken);

    await api('/auth/logout', {
      method: 'POST',
      cookie: session.refreshCookie,
    });

    await api('/auth/refresh', {
      method: 'POST',
      cookie: session.refreshCookie,
      expected: 401,
    });
  });
});
