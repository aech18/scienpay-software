import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GENERADOR,
  RECEPTOR,
  api,
  login,
  uniqueCode,
  uniqueDocument,
} from '../helpers/integration-env.js';
import { createSql, scalar } from '../helpers/db.js';

const CONCURRENT_DISBURSEMENTS = 20;
const REPETITIONS = 10;
const AMOUNT_PER_REQUEST = 50;
const ASSIGNMENT_AMOUNT = 5000;

async function createApprovedRequest(
  generadorToken: string,
  receptorToken: string,
  projectId: string,
  batchId: string,
  index: number,
) {
  const request = await api<{ id: string }>('/payment-requests', {
    method: 'POST',
    token: generadorToken,
    body: {
      projectId,
      causationBatchId: batchId,
      periodDescription: `Concurrencia ${index} - Enero 2026`,
      requestedAmount: AMOUNT_PER_REQUEST,
      notes: `Solicitud concurrente ${index}`,
    },
    expected: 201,
  });
  await api(`/payment-requests/${request.id}/send`, {
    method: 'PATCH',
    token: generadorToken,
  });
  await api(`/payment-requests/${request.id}/approve`, {
    method: 'PATCH',
    token: receptorToken,
  });
  return request.id;
}

async function runScenario(iteration: number) {
  const generador = await login(GENERADOR);
  const receptor = await login(RECEPTOR);
  const suffix = uniqueCode(`X${iteration}`);

  const project = await api<{ id: string }>('/projects', {
    method: 'POST',
    token: generador.accessToken,
    body: {
      code: suffix,
      name: `Proyecto Concurrencia ${iteration} ${suffix}`,
      area: 'BIOLOGIA',
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
      documentNumber: uniqueDocument(`CD${iteration}`),
      firstName: `Concurrente${iteration}`,
      lastName: 'FIFO',
    },
    expected: 201,
  });

  const group = await api<{ id: string }>('/payment-groups', {
    method: 'POST',
    token: generador.accessToken,
    body: {
      name: `Grupo Concurrencia ${iteration} ${suffix}`,
      periodicity: 'MENSUAL',
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
      amountPerPeriod: ASSIGNMENT_AMOUNT,
      currency: 'USD',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    },
    expected: 201,
  });

  const generated = await api<{ batch: { id: string } }>('/causation/generate', {
    method: 'POST',
    token: generador.accessToken,
    body: {
      projectId: project.id,
      paymentGroupId: group.id,
      periodStartDate: '2026-01-01',
      periodEndDate: '2026-01-31',
    },
    expected: 201,
  });

  const requestIds: string[] = [];
  for (let index = 1; index <= CONCURRENT_DISBURSEMENTS; index++) {
    requestIds.push(
      await createApprovedRequest(
        generador.accessToken,
        receptor.accessToken,
        project.id,
        generated.batch.id,
        index,
      ),
    );
  }

  const results = await Promise.allSettled(
    requestIds.map((paymentRequestId, index) =>
      api('/disbursements', {
        method: 'POST',
        token: receptor.accessToken,
        body: {
          paymentRequestId,
          disbursementDate: '2026-02-01',
          totalDeliveredAmount: AMOUNT_PER_REQUEST,
          paymentMethod: 'TRANSFERENCIA',
          referenceNumber: `CONC-${iteration}-${index}-${suffix}`,
          allocations: [{ personId: person.id, amount: AMOUNT_PER_REQUEST }],
        },
        expected: 201,
      }),
    ),
  );

  const failures = results.filter((result) => result.status === 'rejected');
  assert.equal(failures.length, 0, `Fallaron ${failures.length} desembolsos concurrentes`);

  const sql = createSql();
  try {
    const paid = Number(
      (await scalar<string>(
        sql,
        'SELECT COALESCE(SUM(paid_amount), 0)::text FROM causation_items WHERE batch_id = $1',
        [generated.batch.id],
      )) ?? '0',
    );
    const allocated = Number(
      (await scalar<string>(
        sql,
        `SELECT COALESCE(SUM(ra.allocated_amount_usd), 0)::text
         FROM receipt_allocations ra
         INNER JOIN receipts r ON r.id = ra.receipt_id
         WHERE r.person_id = $1 AND r.project_id = $2`,
        [person.id, project.id],
      )) ?? '0',
    );
    const invalidItems = Number(
      (await scalar<string>(
        sql,
        `SELECT COUNT(*)::text FROM causation_items
         WHERE batch_id = $1
           AND (paid_amount > calculated_amount OR remaining_debt < 0
                OR remaining_debt <> calculated_amount - paid_amount)`,
        [generated.batch.id],
      )) ?? '0',
    );

    assert.equal(paid, CONCURRENT_DISBURSEMENTS * AMOUNT_PER_REQUEST);
    assert.equal(allocated, CONCURRENT_DISBURSEMENTS * AMOUNT_PER_REQUEST);
    assert.equal(invalidItems, 0, 'Hay ítems con sobrepago o saldo inconsistente');
  } finally {
    await sql.end();
  }
}

describe('Integración: concurrencia FIFO', () => {
  it(
    `${CONCURRENT_DISBURSEMENTS} desembolsos concurrentes sobre la misma deuda no sobrepagan ni dejan saldos negativos (${REPETITIONS} corridas)`,
    { timeout: 180_000 },
    async () => {
      for (let iteration = 1; iteration <= REPETITIONS; iteration++) {
        await runScenario(iteration);
      }
    },
  );
});
