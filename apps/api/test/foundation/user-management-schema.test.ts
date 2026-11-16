import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createUserSchema, updateUserSchema, UserRole } from '@scienpay/shared';

test('createUserSchema acepta cargo opcional y rol válido', () => {
  const result = createUserSchema.safeParse({
    email: 'NUEVO@scienpay.uc.edu.ve',
    fullName: 'Nuevo Usuario',
    title: 'Analista',
    role: UserRole.RECEPTOR,
    password: 'Clave#Segura2026!',
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.email, 'nuevo@scienpay.uc.edu.ve');
    assert.equal(result.data.title, 'Analista');
  }
});

test('updateUserSchema permite actualizaciones parciales', () => {
  const result = updateUserSchema.safeParse({ fullName: 'Nombre Actualizado' });
  assert.equal(result.success, true);
});

test('updateUserSchema rechaza un objeto vacío', () => {
  const result = updateUserSchema.safeParse({});
  assert.equal(result.success, false);
  if (!result.success) {
    assert.match(result.error.issues[0].message, /AL_MENOS_UN_CAMPO/);
  }
});

test('updateUserSchema valida el rol', () => {
  const result = updateUserSchema.safeParse({ role: 'SUPERADMIN' });
  assert.equal(result.success, false);
});
