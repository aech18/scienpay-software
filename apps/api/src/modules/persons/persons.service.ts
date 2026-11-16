import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../infrastructure/database/database.service.js';
import { persons } from '../../infrastructure/database/schema.js';
import { CreatePersonInput, UpdatePersonInput } from '@scienpay/shared';
import { eq, and } from 'drizzle-orm';
import { AuditService, type AuditActor } from '../audit/audit.service.js';

@Injectable()
export class PersonsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditService: AuditService,
  ) {}

  async listPersons() {
    return this.databaseService.db
      .select()
      .from(persons)
      .orderBy(persons.lastName, persons.firstName);
  }

  async getPersonById(id: string) {
    const [person] = await this.databaseService.db
      .select()
      .from(persons)
      .where(eq(persons.id, id))
      .limit(1);

    if (!person) {
      throw new NotFoundException('PERSONA_NO_ENCONTRADA: El beneficiario especificado no existe');
    }
    return person;
  }

  async createPerson(input: CreatePersonInput, actor: AuditActor) {
    const existing = await this.databaseService.db
      .select({ id: persons.id })
      .from(persons)
      .where(
        and(
          eq(persons.documentType, input.documentType),
          eq(persons.documentNumber, input.documentNumber.trim()),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException(
        'DOCUMENTO_DUPLICADO: Ya existe un beneficiario con este documento',
      );
    }

    const [created] = await this.databaseService.db
      .insert(persons)
      .values({
        documentType: input.documentType,
        documentNumber: input.documentNumber.trim(),
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        email: input.email ? input.email.trim().toLowerCase() : null,
        phone: input.phone || null,
        status: 'ACTIVO',
      })
      .returning();

    await this.auditService.recordEvent({
      userId: actor.userId,
      userEmail: actor.userEmail,
      userRole: actor.userRole,
      action: 'CREACION_PERSONA',
      entity: 'persons',
      entityId: created.id,
      oldValues: null,
      newValues: {
        documentType: created.documentType,
        documentNumber: created.documentNumber,
        firstName: created.firstName,
        lastName: created.lastName,
        email: created.email,
        phone: created.phone,
      },
      ipAddress: actor.ipAddress,
    });

    return created;
  }

  async updatePerson(id: string, input: UpdatePersonInput, actor: AuditActor) {
    const previous = await this.getPersonById(id);

    const [updated] = await this.databaseService.db
      .update(persons)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(persons.id, id))
      .returning();

    await this.auditService.recordEvent({
      userId: actor.userId,
      userEmail: actor.userEmail,
      userRole: actor.userRole,
      action: 'ACTUALIZACION_PERSONA',
      entity: 'persons',
      entityId: id,
      oldValues: {
        documentType: previous.documentType,
        documentNumber: previous.documentNumber,
        firstName: previous.firstName,
        lastName: previous.lastName,
        email: previous.email,
        phone: previous.phone,
        status: previous.status,
      },
      newValues: {
        documentType: updated.documentType,
        documentNumber: updated.documentNumber,
        firstName: updated.firstName,
        lastName: updated.lastName,
        email: updated.email,
        phone: updated.phone,
        status: updated.status,
      },
      ipAddress: actor.ipAddress,
    });

    return updated;
  }
}
