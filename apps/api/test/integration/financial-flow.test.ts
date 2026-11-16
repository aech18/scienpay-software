import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIN,
  GENERADOR,
  RECEPTOR,
  api,
  login,
  uniqueCode,
  uniqueDocument,
} from '../helpers/integration-env.js';

describe('Integración: causación, solicitud, desembolso y auditoría', () => {
  it('ejecuta el flujo financiero completo con cuatro ojos y FIFO', async () => {
    const generador = await login(GENERADOR);
    const receptor = await login(RECEPTOR);

    const project = await api<{ id: string }>('/projects', {
      method: 'POST',
      token: generador.accessToken,
      body: {
        code: uniqueCode('F'),
        name: `Proyecto Flujo ${uniqueCode('L')}`,
        area: 'FISICA',
        scope: 'INTERNO',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      },
      expected: 201,
    });

    const person = await api<{ id: string }>('/persons', {
      method: 'POST',
      token: generador.accessToken,
      body: {
        documentType: 'V',
        documentNumber: uniqueDocument('FL'),
        firstName: 'Marie',
        lastName: 'Curie',
      },
      expected: 201,
    });

    const group = await api<{ id: string }>('/payment-groups', {
      method: 'POST',
      token: generador.accessToken,
      body: {
        name: `Grupo Flujo ${uniqueCode('M')}`,
        periodicity: 'QUINCENAL',
        cutOffConfig: {},
      },
      expected: 201,
    });

    await api('/assignments', {
      method: 'POST',
      token: generador.accessToken,
      body: {
        personId: person.id,
        projectId: project.id,
        paymentGroupId: group.id,
        amountPerPeriod: 250,
        currency: 'USD',
        startDate: '2026-01-01',
        endDate: '2026-03-31',
      },
      expected: 201,
    });

    const period = {
      projectId: project.id,
      paymentGroupId: group.id,
      periodStartDate: '2026-01-01',
      periodEndDate: '2026-01-15',
    };

    const preview = await api<{ itemsCount: number; totalCausationAmount: string }>(
      '/causation/preview',
      { method: 'POST', token: generador.accessToken, body: period, expected: 201 },
    );
    assert.ok(preview.itemsCount >= 1);

    const generated = await api<{
      batch: { id: string; totalCausationAmount: string };
      itemsCount: number;
    }>('/causation/generate', {
      method: 'POST',
      token: generador.accessToken,
      body: period,
      expected: 201,
    });

    const batch = await api<{ id: string; items: unknown[] }>(
      `/causation/batches/${generated.batch.id}`,
      { token: generador.accessToken },
    );
    assert.ok(batch.items.length >= 1);

    const amount = Number(generated.batch.totalCausationAmount);
    const request = await api<{ id: string; requestCode: string; notes: string }>(
      '/payment-requests',
      {
        method: 'POST',
        token: generador.accessToken,
        body: {
          projectId: project.id,
          causationBatchId: generated.batch.id,
          periodDescription: 'Primera quincena de enero 2026',
          requestedAmount: amount,
          notes: 'Nota de integración persistida',
        },
        expected: 201,
      },
    );
    assert.match(request.requestCode, /^SOL-\d{4}-\d{3,}$/);
    assert.equal(request.notes, 'Nota de integración persistida');

    await api(`/payment-requests/${request.id}/send`, {
      method: 'PATCH',
      token: generador.accessToken,
    });

    await api(`/payment-requests/${request.id}/approve`, {
      method: 'PATCH',
      token: receptor.accessToken,
    });

    const disbursement = await api<{
      disbursement: { id: string; totalAmount: string };
      receipts: Array<{ receiptNumber: string }>;
    }>('/disbursements', {
      method: 'POST',
      token: receptor.accessToken,
      body: {
        paymentRequestId: request.id,
        disbursementDate: '2026-01-16',
        totalDeliveredAmount: amount,
        paymentMethod: 'TRANSFERENCIA',
        referenceNumber: `REF-${uniqueCode('R')}`,
        notes: 'Desembolso de integración',
        allocations: [{ personId: person.id, amount }],
      },
      expected: 201,
    });
    assert.equal(disbursement.receipts.length, 1);
    assert.match(disbursement.receipts[0].receiptNumber, /^REC-\d{4}-\d{6}$/);

    const pdfResponse = await api<Response>(`/payment-requests/${request.id}/pdf`, {
      token: receptor.accessToken,
      raw: true,
    });
    assert.equal(pdfResponse.headers.get('content-type'), 'application/pdf');
    const pdfBytes = new Uint8Array(await pdfResponse.arrayBuffer());
    assert.equal(String.fromCharCode(...pdfBytes.slice(0, 4)), '%PDF');

    await api(`/payment-requests/${request.id}/close`, {
      method: 'PATCH',
      token: receptor.accessToken,
    });

    const admin = await login(ADMIN);
    const audit = await api<{ data: Array<{ entityId: string; action: string }> }>(
      '/audit?action=CREACION_SOLICITUD&limit=50',
      { token: admin.accessToken },
    );
    assert.ok(audit.data.some((event) => event.entityId === request.id));
  });
});
