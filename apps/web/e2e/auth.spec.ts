import { expect, test } from '@playwright/test';
import { login, USERS } from './helpers.js';

test.describe('Autenticación', () => {
  test('rechaza credenciales inválidas sin iniciar sesión', async ({ page }) => {
    await login(page, { identifier: 'usuario.inexistente', password: 'Incorrecta#2026' });

    await expect(page.getByText(/CREDENCIALES_INVALIDAS/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Iniciar Sesión en Scienpay' })).toBeVisible();
  });

  test('inicia sesión y restaura la sesión al recargar', async ({ page }) => {
    await login(page, USERS.ADMIN);

    await expect(
      page.getByRole('heading', { name: 'Usuarios, Roles y Control de Seguridad' }),
    ).toBeVisible();

    await page.reload();

    await expect(
      page.getByRole('heading', { name: 'Usuarios, Roles y Control de Seguridad' }),
    ).toBeVisible();
    await expect(page.getByText('ADMIN', { exact: true }).first()).toBeVisible();
  });

  test('cierra sesión solo después de confirmar', async ({ page }) => {
    await login(page, USERS.ADMIN);
    await expect(page.getByRole('heading', { name: /Usuarios, Roles/ })).toBeVisible();

    await page.getByRole('button', { name: 'Cerrar Sesión' }).click();
    await expect(page.getByRole('heading', { name: /seguro de cerrar sesión/ })).toBeVisible();

    await page.getByRole('button', { name: 'Cerrar Sesión' }).last().click();

    await expect(page.getByRole('heading', { name: 'Iniciar Sesión en Scienpay' })).toBeVisible();
  });
});
