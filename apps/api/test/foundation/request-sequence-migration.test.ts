import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.join(
  process.cwd(),
  'src',
  'infrastructure',
  'database',
  'migrations',
  '0005_request_sequences_and_notes.sql',
);
const servicePath = path.join(
  process.cwd(),
  'src',
  'modules',
  'payment-requests',
  'payment-requests.service.ts',
);

const sql = fs.readFileSync(migrationPath, 'utf8');
const service = fs.readFileSync(servicePath, 'utf8');

describe('Migración 0005: numeración de solicitudes y notas (Fase 4.6)', () => {
  it('crea el contador transaccional y siembra desde solicitudes existentes', () => {
    assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS request_sequences'));
    assert.ok(sql.includes('CREATE OR REPLACE FUNCTION next_request_number'));
    assert.ok(sql.includes('ON CONFLICT (year) DO UPDATE'));
    assert.ok(sql.includes("request_code ~ '^SOL-[0-9]{4}-[0-9]+$'"));
    assert.ok(sql.includes('GREATEST(request_sequences.last_number, EXCLUDED.last_number)'));
  });

  it('agrega la columna notes de forma idempotente', () => {
    assert.ok(sql.includes('ADD COLUMN IF NOT EXISTS notes TEXT'));
  });

  it('usa la secuencia y persiste notes dentro de la transacción de creación', () => {
    assert.ok(service.includes('SELECT next_request_number(${year})'));
    assert.ok(service.includes('notes: input.notes ||'));
    assert.ok(service.includes('db.transaction(async (tx) =>'));
  });
});
