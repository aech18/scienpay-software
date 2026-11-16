import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from '../../infrastructure/database/database.service.js';
import {
  paymentRequests,
  causationBatches,
  causationItems,
  persons,
  projects,
  users,
} from '../../infrastructure/database/schema.js';
import {
  CreatePaymentRequestInput,
  RejectPaymentRequestInput,
  PaymentRequestStatus,
  CausationBatchStatus,
  UserRole,
} from '@scienpay/shared';
import { PaymentRequestStateMachine } from '../../domain/payment-requests/payment-request-state-machine.js';
import { RolePermissionsPolicy } from '../../domain/security/role-permissions.policy.js';
import { PdfReceiptGenerator } from '../../infrastructure/pdf/pdf-receipt.generator.js';
import { eq, desc, sql } from 'drizzle-orm';
import { Decimal } from 'decimal.js';
import { AuditService, type AuditActor } from '../audit/audit.service.js';

@Injectable()
export class PaymentRequestsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditService: AuditService,
  ) {}

  async listRequests(projectId?: string) {
    if (projectId) {
      return this.databaseService.db
        .select()
        .from(paymentRequests)
        .where(eq(paymentRequests.projectId, projectId))
        .orderBy(desc(paymentRequests.createdAt));
    }
    return this.databaseService.db
      .select()
      .from(paymentRequests)
      .orderBy(desc(paymentRequests.createdAt));
  }

  async getRequestById(id: string) {
    const [request] = await this.databaseService.db
      .select()
      .from(paymentRequests)
      .where(eq(paymentRequests.id, id))
      .limit(1);

    if (!request) {
      throw new NotFoundException('SOLICITUD_NO_ENCONTRADA: La solicitud de pago no existe');
    }
    return request;
  }

  /**
   * PDF consolidado de la solicitud (HANDOFF 2.3).
   * Incluye cabecera, beneficiarios del lote, causado/pagado/pendiente,
   * totales y firmas. Las cifras se recalculan desde la BD en el momento.
   */
  async generateRequestPdfBuffer(requestId: string): Promise<{ buffer: Buffer; filename: string }> {
    const request = await this.getRequestById(requestId);

    const [project] = await this.databaseService.db
      .select()
      .from(projects)
      .where(eq(projects.id, request.projectId))
      .limit(1);

    const [creator] = await this.databaseService.db
      .select()
      .from(users)
      .where(eq(users.id, request.createdByUserId))
      .limit(1);

    const [reviewer] = request.reviewedByUserId
      ? await this.databaseService.db
          .select()
          .from(users)
          .where(eq(users.id, request.reviewedByUserId))
          .limit(1)
      : [];

    const items = await this.databaseService.db
      .select({
        periodStartDate: causationItems.periodStartDate,
        periodEndDate: causationItems.periodEndDate,
        calculatedAmount: causationItems.calculatedAmount,
        paidAmount: causationItems.paidAmount,
        remainingDebt: causationItems.remainingDebt,
        status: causationItems.status,
        firstName: persons.firstName,
        lastName: persons.lastName,
        documentType: persons.documentType,
        documentNumber: persons.documentNumber,
      })
      .from(causationItems)
      .innerJoin(persons, eq(causationItems.personId, persons.id))
      .where(eq(causationItems.batchId, request.causationBatchId))
      .orderBy(causationItems.periodStartDate, persons.lastName);

    let totalCalculated = new Decimal('0.00');
    let totalPaid = new Decimal('0.00');
    let totalRemaining = new Decimal('0.00');

    const pdfItems = items.map((item) => {
      totalCalculated = totalCalculated.plus(item.calculatedAmount);
      totalPaid = totalPaid.plus(item.paidAmount);
      totalRemaining = totalRemaining.plus(item.remainingDebt);

      return {
        beneficiaryName: `${item.firstName} ${item.lastName}`,
        beneficiaryDocument: `${item.documentType}-${item.documentNumber}`,
        period: `${item.periodStartDate} al ${item.periodEndDate}`,
        calculatedAmountUSD: item.calculatedAmount,
        paidAmountUSD: item.paidAmount,
        remainingDebtUSD: item.remainingDebt,
        status: item.status,
      };
    });

    const buffer = await PdfReceiptGenerator.generatePaymentRequestPdf({
      requestCode: request.requestCode,
      issuedDate: new Date(request.createdAt).toISOString().split('T')[0],
      projectName: project ? `${project.name} (${project.code})` : 'Proyecto Científico',
      periodDescription: request.periodDescription,
      status: request.status,
      totalAmountUSD: request.totalAmountUSD,
      createdByName: creator ? creator.fullName : 'Generador de Nómina',
      reviewedByName: reviewer ? reviewer.fullName : '',
      items: pdfItems,
      totalCalculatedUSD: totalCalculated.toFixed(2),
      totalPaidUSD: totalPaid.toFixed(2),
      totalRemainingUSD: totalRemaining.toFixed(2),
    });

    return {
      buffer,
      filename: `${request.requestCode}.pdf`,
    };
  }

  async createRequest(input: CreatePaymentRequestInput, actor: AuditActor) {
    // 1. Obtener lote de causación
    const [batch] = await this.databaseService.db
      .select()
      .from(causationBatches)
      .where(eq(causationBatches.id, input.causationBatchId))
      .limit(1);

    if (!batch) {
      throw new NotFoundException('LOTE_NO_ENCONTRADO: El lote de causación no existe');
    }

    // 2. Un lote anulado no puede originar nuevas solicitudes.
    if (batch.status === CausationBatchStatus.ANULADO) {
      throw new ConflictException(
        'LOTE_ANULADO: No se puede crear una solicitud a partir de un lote de causación anulado',
      );
    }

    // 3. El lote debe pertenecer al proyecto indicado en la solicitud.
    if (batch.projectId !== input.projectId) {
      throw new ConflictException(
        'PROYECTO_INCOMPATIBLE: El lote de causación no pertenece al proyecto indicado',
      );
    }

    // 4. El monto solicitado no puede exceder el total causado del lote.
    const requestedAmount = new Decimal(input.requestedAmount);
    const totalCausation = new Decimal(batch.totalCausationAmount);

    if (requestedAmount.greaterThan(totalCausation)) {
      throw new ConflictException(
        'MONTO_EXCEDE_CAUSACION: El monto solicitado no puede exceder el total causado del lote',
      );
    }

    // 5. Generar código correlativo de solicitud: SOL-YYYY-NNN
    const year = new Date().getFullYear();

    return this.databaseService.db.transaction(async (tx) => {
      const sequenceResult = await tx.execute(
        sql`SELECT next_request_number(${year}) AS next_number`,
      );
      const nextNumber = Number((sequenceResult as any)[0]?.next_number ?? 0);

      if (!Number.isFinite(nextNumber) || nextNumber <= 0) {
        throw new ConflictException(
          'SECUENCIA_SOLICITUD_INVALIDA: No se pudo reservar el numero de solicitud',
        );
      }

      const requestCode = `SOL-${year}-${nextNumber.toString().padStart(3, '0')}`;

      const [created] = await tx
        .insert(paymentRequests)
        .values({
          requestCode,
          projectId: input.projectId,
          causationBatchId: input.causationBatchId,
          periodDescription:
            input.periodDescription || `${batch.periodStartDate} al ${batch.periodEndDate}`,
          totalAmountUSD: requestedAmount.toFixed(2),
          notes: input.notes || '',
          status: PaymentRequestStatus.BORRADOR,
          createdByUserId: actor.userId!,
        })
        .returning();

      await this.auditService.recordEvent(
        {
          userId: actor.userId,
          userEmail: actor.userEmail,
          userRole: actor.userRole,
          action: 'CREACION_SOLICITUD',
          entity: 'payment_requests',
          entityId: created.id,
          oldValues: null,
          newValues: {
            requestCode: created.requestCode,
            projectId: created.projectId,
            causationBatchId: created.causationBatchId,
            totalAmountUSD: created.totalAmountUSD,
            notes: created.notes,
            status: created.status,
          },
          ipAddress: actor.ipAddress,
        },
        tx,
      );

      return created;
    });
  }

  async sendRequest(id: string, actor: AuditActor) {
    const request = await this.getRequestById(id);

    PaymentRequestStateMachine.assertValidTransition(
      request.status as PaymentRequestStatus,
      PaymentRequestStatus.ENVIADA,
    );

    const [updated] = await this.databaseService.db
      .update(paymentRequests)
      .set({
        status: PaymentRequestStatus.ENVIADA,
        updatedAt: new Date(),
      })
      .where(eq(paymentRequests.id, id))
      .returning();

    await this.auditService.recordEvent({
      userId: actor.userId,
      userEmail: actor.userEmail,
      userRole: actor.userRole,
      action: 'ENVIO_SOLICITUD',
      entity: 'payment_requests',
      entityId: id,
      oldValues: { status: request.status },
      newValues: { status: updated.status },
      ipAddress: actor.ipAddress,
    });

    return updated;
  }

  async approveRequest(
    id: string,
    reviewerUserId: string,
    reviewerRole: UserRole,
    actor: AuditActor,
  ) {
    const request = await this.getRequestById(id);

    // 1. REGLA DE CUATRO OJOS (ADR-006 & Especificación)
    const canApprove = RolePermissionsPolicy.canApproveRequest(
      request.createdByUserId,
      reviewerUserId,
      reviewerRole,
    );

    if (!canApprove) {
      throw new ForbiddenException(
        'REGLA_CUATRO_OJOS_VIOLADA: El creador de la solicitud no puede ser su propio aprobador. Debe aprobar un Receptor independiente.',
      );
    }

    // 2. Transición válida
    PaymentRequestStateMachine.assertValidTransition(
      request.status as PaymentRequestStatus,
      PaymentRequestStatus.APROBADA,
    );

    const [updated] = await this.databaseService.db
      .update(paymentRequests)
      .set({
        status: PaymentRequestStatus.APROBADA,
        reviewedByUserId: reviewerUserId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(paymentRequests.id, id))
      .returning();

    await this.auditService.recordEvent({
      userId: actor.userId,
      userEmail: actor.userEmail,
      userRole: actor.userRole,
      action: 'APROBACION_SOLICITUD',
      entity: 'payment_requests',
      entityId: id,
      oldValues: { status: request.status },
      newValues: {
        status: updated.status,
        reviewedByUserId: updated.reviewedByUserId,
        reviewedAt: updated.reviewedAt,
      },
      ipAddress: actor.ipAddress,
    });

    return updated;
  }

  async rejectRequest(
    id: string,
    reviewerUserId: string,
    reviewerRole: UserRole,
    input: RejectPaymentRequestInput,
    actor: AuditActor,
  ) {
    const request = await this.getRequestById(id);

    if (reviewerRole !== UserRole.RECEPTOR) {
      throw new ForbiddenException('ACCESO_DENEGADO: Solo el Receptor puede rechazar solicitudes');
    }

    PaymentRequestStateMachine.assertValidTransition(
      request.status as PaymentRequestStatus,
      PaymentRequestStatus.RECHAZADA,
    );

    const [updated] = await this.databaseService.db
      .update(paymentRequests)
      .set({
        status: PaymentRequestStatus.RECHAZADA,
        reviewedByUserId: reviewerUserId,
        reviewedAt: new Date(),
        rejectionReason: input.rejectionReason,
        updatedAt: new Date(),
      })
      .where(eq(paymentRequests.id, id))
      .returning();

    await this.auditService.recordEvent({
      userId: actor.userId,
      userEmail: actor.userEmail,
      userRole: actor.userRole,
      action: 'RECHAZO_SOLICITUD',
      entity: 'payment_requests',
      entityId: id,
      oldValues: { status: request.status },
      newValues: {
        status: updated.status,
        rejectionReason: updated.rejectionReason,
        reviewedByUserId: updated.reviewedByUserId,
        reviewedAt: updated.reviewedAt,
      },
      ipAddress: actor.ipAddress,
    });

    return updated;
  }

  async closeRequest(id: string, actor: AuditActor) {
    const request = await this.getRequestById(id);

    PaymentRequestStateMachine.assertValidTransition(
      request.status as PaymentRequestStatus,
      PaymentRequestStatus.CERRADA,
    );

    const [updated] = await this.databaseService.db
      .update(paymentRequests)
      .set({
        status: PaymentRequestStatus.CERRADA,
        updatedAt: new Date(),
      })
      .where(eq(paymentRequests.id, id))
      .returning();

    await this.auditService.recordEvent({
      userId: actor.userId,
      userEmail: actor.userEmail,
      userRole: actor.userRole,
      action: 'CIERRE_SOLICITUD',
      entity: 'payment_requests',
      entityId: id,
      oldValues: { status: request.status },
      newValues: { status: updated.status },
      ipAddress: actor.ipAddress,
    });

    return updated;
  }
}
