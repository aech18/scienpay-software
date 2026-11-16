import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../infrastructure/database/database.service.js';
import {
  assignments,
  persons,
  projects,
  paymentGroups,
} from '../../infrastructure/database/schema.js';
import {
  CreateAssignmentInput,
  TerminateAssignmentInput,
  AssignmentStatus,
} from '@scienpay/shared';
import { AssignmentOverlapPolicy } from '../../domain/assignments/assignment-overlap.policy.js';
import { eq, and } from 'drizzle-orm';
import { Decimal } from 'decimal.js';
import { AuditService, type AuditActor } from '../audit/audit.service.js';

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditService: AuditService,
  ) {}

  async listAssignments(projectId?: string) {
    if (projectId) {
      return this.databaseService.db
        .select()
        .from(assignments)
        .where(eq(assignments.projectId, projectId))
        .orderBy(assignments.startDate);
    }
    return this.databaseService.db.select().from(assignments).orderBy(assignments.startDate);
  }

  async getAssignmentById(id: string) {
    const [assignment] = await this.databaseService.db
      .select()
      .from(assignments)
      .where(eq(assignments.id, id))
      .limit(1);

    if (!assignment) {
      throw new NotFoundException('ASIGNACION_NO_ENCONTRADA: La asignación no existe');
    }
    return assignment;
  }

  async createAssignment(input: CreateAssignmentInput, actor: AuditActor) {
    // 1. Validar existencia de entidades relacionadas
    const [person] = await this.databaseService.db
      .select({ id: persons.id })
      .from(persons)
      .where(eq(persons.id, input.personId))
      .limit(1);
    if (!person) {
      throw new NotFoundException('PERSONA_NO_ENCONTRADA');
    }

    const [project] = await this.databaseService.db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, input.projectId))
      .limit(1);
    if (!project) {
      throw new NotFoundException('PROYECTO_NO_ENCONTRADO');
    }

    const [group] = await this.databaseService.db
      .select({ id: paymentGroups.id })
      .from(paymentGroups)
      .where(eq(paymentGroups.id, input.paymentGroupId))
      .limit(1);
    if (!group) {
      throw new NotFoundException('GRUPO_PAGO_NO_ENCONTRADO');
    }

    // 2. Verificar solapamiento de asignaciones activas de la persona en el proyecto
    const existing = await this.databaseService.db
      .select({
        id: assignments.id,
        startDate: assignments.startDate,
        endDate: assignments.endDate,
      })
      .from(assignments)
      .where(
        and(
          eq(assignments.personId, input.personId),
          eq(assignments.projectId, input.projectId),
          eq(assignments.status, AssignmentStatus.ACTIVO),
        ),
      );

    const hasOverlap = AssignmentOverlapPolicy.hasOverlap(existing, {
      startDate: input.startDate,
      endDate: input.endDate || null,
    });

    if (hasOverlap) {
      throw new ConflictException(
        'SOLAPAMIENTO_ASIGNACION: La persona ya posee una asignación activa en este proyecto cuyas fechas se intersectan con el período indicado',
      );
    }

    const amountFormatted = new Decimal(input.amountPerPeriod).toFixed(2);

    const [created] = await this.databaseService.db
      .insert(assignments)
      .values({
        personId: input.personId,
        projectId: input.projectId,
        paymentGroupId: input.paymentGroupId,
        amountPerPeriod: amountFormatted,
        currency: 'USD',
        startDate: input.startDate,
        endDate: input.endDate || null,
        status: AssignmentStatus.ACTIVO,
        notes: input.notes || '',
      })
      .returning();

    await this.auditService.recordEvent({
      userId: actor.userId,
      userEmail: actor.userEmail,
      userRole: actor.userRole,
      action: 'CREACION_ASIGNACION',
      entity: 'assignments',
      entityId: created.id,
      oldValues: null,
      newValues: {
        personId: created.personId,
        projectId: created.projectId,
        paymentGroupId: created.paymentGroupId,
        amountPerPeriod: created.amountPerPeriod,
        currency: created.currency,
        startDate: created.startDate,
        endDate: created.endDate,
        status: created.status,
      },
      ipAddress: actor.ipAddress,
    });

    return created;
  }

  async terminateAssignment(id: string, input: TerminateAssignmentInput, actor: AuditActor) {
    const existing = await this.getAssignmentById(id);

    if (new Date(input.endDate) < new Date(existing.startDate)) {
      throw new ConflictException(
        'FECHA_INVALIDA: La fecha de término no puede ser anterior a la de inicio',
      );
    }

    const [updated] = await this.databaseService.db
      .update(assignments)
      .set({
        endDate: input.endDate,
        status: AssignmentStatus.INACTIVO,
        notes: `${existing.notes || ''} [Terminada: ${input.reason}]`.trim(),
        updatedAt: new Date(),
      })
      .where(eq(assignments.id, id))
      .returning();

    await this.auditService.recordEvent({
      userId: actor.userId,
      userEmail: actor.userEmail,
      userRole: actor.userRole,
      action: 'TERMINACION_ASIGNACION',
      entity: 'assignments',
      entityId: id,
      oldValues: {
        startDate: existing.startDate,
        endDate: existing.endDate,
        status: existing.status,
        notes: existing.notes,
      },
      newValues: {
        startDate: updated.startDate,
        endDate: updated.endDate,
        status: updated.status,
        notes: updated.notes,
        reason: input.reason,
      },
      ipAddress: actor.ipAddress,
    });

    return updated;
  }
}
