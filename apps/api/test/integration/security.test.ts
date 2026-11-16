import { describe, it } from 'node:test';
import { ADMIN, GENERADOR, api, login } from '../helpers/integration-env.js';

describe('Integración: seguridad y RBAC', () => {
  it('rechaza peticiones sin token', async () => {
    await api('/projects', { expected: 401 });
  });

  it('impide que ADMIN opere proyectos aunque consulte catálogos', async () => {
    const admin = await login(ADMIN);
    await api('/projects', { token: admin.accessToken });
    await api('/projects', {
      method: 'POST',
      token: admin.accessToken,
      body: {
        code: 'ADMIN-BLOCK',
        name: 'No permitido',
        area: 'BIOLOGIA',
        scope: 'INTERNO',
        startDate: '2026-01-01',
      },
      expected: 403,
    });
  });

  it('impide que GENERADOR consulte la auditoría', async () => {
    const generador = await login(GENERADOR);
    await api('/audit', { token: generador.accessToken, expected: 403 });
  });

  it('valida UUIDs en el borde HTTP', async () => {
    const admin = await login(ADMIN);
    await api('/projects/not-a-uuid', { token: admin.accessToken, expected: 400 });
    await api('/payment-requests?projectId=not-a-uuid', {
      token: admin.accessToken,
      expected: 400,
    });
  });
});
