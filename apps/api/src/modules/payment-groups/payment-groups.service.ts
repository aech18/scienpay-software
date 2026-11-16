import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../infrastructure/database/database.service.js';
import { paymentGroups } from '../../infrastructure/database/schema.js';
import { CreatePaymentGroupInput } from '@scienpay/shared';
import { eq } from 'drizzle-orm';
import { AuditService, type AuditActor } from '../audit/audit.service.js';

@Injectable()
export class PaymentGroupsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditService: AuditService,
  ) {}

  async listPaymentGroups() {
    return this.databaseService.db.select().from(paymentGroups).orderBy(paymentGroups.name);
  }

  async getPaymentGroupById(id: string) {
    const [group] = await this.databaseService.db
      .select()
      .from(paymentGroups)
      .where(eq(paymentGroups.id, id))
      .limit(1);

    if (!group) {
      throw new NotFoundException('GRUPO_PAGO_NO_ENCONTRADO: El grupo de pago no existe');
    }
    return group;
  }

  async createPaymentGroup(input: CreatePaymentGroupInput, actor: AuditActor) {
    const existing = await this.databaseService.db
      .select({ id: paymentGroups.id })
      .from(paymentGroups)
      .where(eq(paymentGroups.name, input.name.trim()))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException('NOMBRE_DUPLICADO: Ya existe un grupo de pago con este nombre');
    }

    const [created] = await this.databaseService.db
      .insert(paymentGroups)
      .values({
        name: input.name.trim(),
        periodicity: input.periodicity,
        cutOffConfig: input.cutOffConfig || {},
        description: input.description || '',
      })
      .returning();

    await this.auditService.recordEvent({
      userId: actor.userId,
      userEmail: actor.userEmail,
      userRole: actor.userRole,
      action: 'CREACION_GRUPO_PAGO',
      entity: 'payment_groups',
      entityId: created.id,
      oldValues: null,
      newValues: {
        name: created.name,
        periodicity: created.periodicity,
        cutOffConfig: created.cutOffConfig,
        description: created.description,
      },
      ipAddress: actor.ipAddress,
    });

    return created;
  }
}
