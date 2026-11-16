import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GENERADOR, RECEPTOR, api, login, uniqueCode } from '../helpers/integration-env.js';

describe('Integración: caja chica', () => {
  it('abre período, solicita, aprueba, desembolsa, rinde y cierra', async () => {
    const generador = await login(GENERADOR);
    const receptor = await login(RECEPTOR);

    const project = await api<{ id: string }>('/projects', {
      method: 'POST',
      token: generador.accessToken,
      body: {
        code: uniqueCode('C'),
        name: `Proyecto Caja ${uniqueCode('J')}`,
        area: 'QUIMICA',
        scope: 'INTERNO',
        startDate: '2026-01-01',
      },
      expected: 201,
    });

    const pettyCash = await api<{ id: string }>('/petty-cash', {
      method: 'POST',
      token: receptor.accessToken,
      body: {
        name: `Caja Integración ${uniqueCode('K')}`,
        description: 'Caja de la suite de integración',
        custodianName: 'Ada Lovelace',
        projectIds: [project.id],
      },
      expected: 201,
    });

    const period = await api<{ id: string; status: string }>(
      `/petty-cash/${pettyCash.id}/periods`,
      {
        method: 'POST',
        token: receptor.accessToken,
        body: { periodYear: 2026, periodMonth: 1, openingBalance: 1000 },
        expected: 201,
      },
    );
    assert.equal(period.status, 'ABIERTO');

    const voucher = await api<{ id: string; voucherNumber: string }>(
      `/petty-cash/periods/${period.id}/vouchers`,
      {
        method: 'POST',
        token: generador.accessToken,
        body: {
          projectId: project.id,
          requestedAmount: 100,
          purpose: 'Compra de insumos de laboratorio',
        },
        expected: 201,
      },
    );
    assert.match(voucher.voucherNumber, /^VAL-\d{4}-\d{4}$/);

    await api(`/petty-cash/vouchers/${voucher.id}/approve`, {
      method: 'PATCH',
      token: receptor.accessToken,
    });
    await api(`/petty-cash/vouchers/${voucher.id}/disburse`, {
      method: 'PATCH',
      token: receptor.accessToken,
    });
    await api(`/petty-cash/vouchers/${voucher.id}/render`, {
      method: 'PATCH',
      token: receptor.accessToken,
      body: {
        renderedAmount: 80,
        changeAmount: 20,
        invoiceReference: `FAC-${uniqueCode('V')}`,
      },
    });

    const periods = await api<Array<{ id: string; closingBalance: string }>>(
      `/petty-cash/${pettyCash.id}/periods`,
      { token: receptor.accessToken },
    );
    assert.ok(periods.some((item) => item.id === period.id));

    const vouchers = await api<Array<{ id: string; status: string }>>(
      `/petty-cash/periods/${period.id}/vouchers`,
      { token: receptor.accessToken },
    );
    assert.equal(vouchers.find((item) => item.id === voucher.id)?.status, 'RENDIDO');

    await api(`/petty-cash/periods/${period.id}/close`, {
      method: 'PATCH',
      token: receptor.accessToken,
    });
  });
});
