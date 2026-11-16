import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PaymentMethod } from '@scienpay/shared';
import { DisbursementForm } from './DisbursementForm.js';

const mutateAsync = vi.fn().mockResolvedValue({ receipts: [] });
const showToast = vi.fn();

vi.mock('../../hooks/useDisbursements.js', () => ({
  useRegisterDisbursement: () => ({ mutateAsync, isPending: false }),
}));

vi.mock('../../context/ToastContext.js', () => ({
  useToast: () => ({ showToast }),
}));

const persons = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    documentType: 'V',
    documentNumber: '1001',
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: null,
    phone: null,
    specialty: 'Investigación',
    status: 'ACTIVO',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    documentType: 'V',
    documentNumber: '1002',
    firstName: 'Alan',
    lastName: 'Turing',
    email: null,
    phone: null,
    specialty: 'Investigación',
    status: 'ACTIVO',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

const batch = {
  id: '33333333-3333-4333-8333-333333333333',
  projectId: '44444444-4444-4444-8444-444444444444',
  paymentGroupId: '55555555-5555-4555-8555-555555555555',
  periodStartDate: '2026-01-01',
  periodEndDate: '2026-01-15',
  totalCausationAmount: '0.30',
  status: 'CALCULADO',
  calculatedByUserId: '66666666-6666-4666-8666-666666666666',
  annulmentReason: null,
  annulledByUserId: null,
  annulledAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  items: [
    {
      id: 'i1',
      batchId: '33333333-3333-4333-8333-333333333333',
      personId: persons[0].id,
      assignmentId: 'a1',
      periodStartDate: '2026-01-01',
      periodEndDate: '2026-01-15',
      totalDaysInPeriod: 15,
      activeDays: 15,
      baseAmount: '0.10',
      calculatedAmount: '0.10',
      paidAmount: '0.00',
      remainingDebt: '0.10',
      status: 'PENDIENTE',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'i2',
      batchId: '33333333-3333-4333-8333-333333333333',
      personId: persons[1].id,
      assignmentId: 'a2',
      periodStartDate: '2026-01-01',
      periodEndDate: '2026-01-15',
      totalDaysInPeriod: 15,
      activeDays: 15,
      baseAmount: '0.20',
      calculatedAmount: '0.20',
      paidAmount: '0.00',
      remainingDebt: '0.20',
      status: 'PENDIENTE',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
};

const request = {
  id: '77777777-7777-4777-8777-777777777777',
  requestCode: 'SOL-2026-001',
  projectId: batch.projectId,
  causationBatchId: batch.id,
  periodDescription: 'Enero 2026',
  totalAmountUSD: '0.30',
  notes: '',
  status: 'APROBADA',
  createdByUserId: '66666666-6666-4666-8666-666666666666',
  reviewedByUserId: '88888888-8888-4888-8888-888888888888',
  reviewedAt: '2026-01-02T00:00:00.000Z',
  rejectionReason: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

describe('DisbursementForm', () => {
  it('calcula el total en centavos y envía importes exactos', async () => {
    const user = userEvent.setup();
    render(
      <DisbursementForm
        request={request as never}
        batch={batch as never}
        persons={persons as never}
        onSuccess={vi.fn()}
      />,
    );

    const amountInputs = screen.getAllByPlaceholderText('0.00');
    await user.type(amountInputs[0], '0.1');
    await user.type(amountInputs[1], '0.2');

    expect(screen.getAllByText(/\$0,30 USD/).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /Registrar Desembolso/ }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync.mock.calls[0][0]).toMatchObject({
      paymentRequestId: request.id,
      totalDeliveredAmount: 0.3,
      paymentMethod: PaymentMethod.TRANSFERENCIA,
      allocations: [
        { personId: persons[0].id, amount: 0.1 },
        { personId: persons[1].id, amount: 0.2 },
      ],
    });
  });
});
