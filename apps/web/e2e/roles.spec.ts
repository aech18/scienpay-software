import { expect, test } from '@playwright/test';
import { login, USERS } from './helpers.js';

test.describe('Vistas y navegación por rol', () => {
  test('ADMIN accede a usuarios y auditoría sin módulos financieros', async ({ page }) => {
    await login(page, USERS.ADMIN);

    await expect(
      page.getByRole('heading', { name: 'Usuarios, Roles y Control de Seguridad' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /Proyectos Científicos/ })).toHaveCount(0);

    await page.getByRole('button', { name: /Registro de Auditoría/ }).click();
    await expect(
      page.getByRole('heading', { name: /Registro de Auditoría Append-Only/ }),
    ).toBeVisible();
  });

  test('GENERADOR navega proyectos, asignaciones y causación', async ({ page }) => {
    await login(page, USERS.GENERADOR);

    await expect(
      page.getByRole('heading', { name: 'Proyectos de Investigación Científica' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /Registro de Auditoría/ })).toHaveCount(0);

    await page.getByRole('button', { name: /Asignaciones y Grupos/ }).click();
    await expect(
      page.getByRole('heading', { name: 'Asignaciones y Grupos de Pago' }),
    ).toBeVisible();

    await page.getByRole('button', { name: /Motor de Causación/ }).click();
    await expect(
      page.getByRole('heading', { name: /Motor de Causación y Prorrateo/ }),
    ).toBeVisible();
  });

  test('RECEPTOR navega aprobación, pagos y caja chica', async ({ page }) => {
    await login(page, USERS.RECEPTOR);

    await expect(
      page.getByRole('heading', { name: /Bandeja de Fiscalización y Aprobación/ }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /Usuarios y Roles/ })).toHaveCount(0);

    await page.getByRole('button', { name: /Entregas de Fondos/ }).click();
    await expect(
      page.getByRole('heading', { name: /Entregas de Fondos con Imputación FIFO/ }),
    ).toBeVisible();

    await page.getByRole('button', { name: /Cajas Chicas/ }).click();
    await expect(
      page.getByRole('heading', { name: 'Control Mensual de Cajas Chicas' }),
    ).toBeVisible();
  });
});
