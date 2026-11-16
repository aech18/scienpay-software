import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildOpenApiDocument } from '../../src/infrastructure/openapi/openapi.js';

describe('Contrato OpenAPI generado desde Zod', () => {
  const document = buildOpenApiDocument();

  it('publica la versión y el servidor versionado', () => {
    assert.equal(document.openapi, '3.0.3');
    assert.equal(document.servers?.[0]?.url, '/api/v1');
  });

  it('declara autenticación bearer reutilizable', () => {
    assert.equal(document.components?.securitySchemes?.bearerAuth?.scheme, 'bearer');
  });

  it('incluye los flujos críticos de la API', () => {
    const paths = Object.keys(document.paths ?? {});

    for (const path of [
      '/auth/login',
      '/auth/refresh',
      '/users',
      '/users/{id}',
      '/projects',
      '/persons',
      '/assignments',
      '/causation/generate',
      '/payment-requests',
      '/payment-requests/{id}/approve',
      '/disbursements',
      '/petty-cash',
      '/audit',
    ]) {
      assert.ok(paths.includes(path), `Falta la ruta ${path}`);
    }
  });

  it('no duplica componentes de request', () => {
    const schemas = document.components?.schemas ?? {};
    assert.ok(schemas.CreateUserInput);
    assert.ok(schemas.UpdateUserInput);
    assert.ok(schemas.RegisterDisbursementInput);
    assert.ok(schemas.ErrorResponse);
  });
});
