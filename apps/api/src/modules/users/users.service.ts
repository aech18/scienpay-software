import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../infrastructure/database/database.service.js';
import { refreshTokens, users } from '../../infrastructure/database/schema.js';
import { PasswordService } from '../../domain/security/password.service.js';
import { AuditService, type AuditActor } from '../audit/audit.service.js';
import { and, count, eq, isNull, ne, or } from 'drizzle-orm';
import { CreateUserInput, UpdateUserInput, UserRole } from '@scienpay/shared';

@Injectable()
export class UsersService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly passwordService: PasswordService,
    private readonly auditService: AuditService,
  ) {}

  async listUsers() {
    return this.databaseService.db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        fullName: users.fullName,
        title: users.title,
        role: users.role,
        failedAttempts: users.failedAttempts,
        isLocked: users.isLocked,
        lockoutExpiresAt: users.lockoutExpiresAt,
        permanentLock: users.permanentLock,
        isActive: users.isActive,
        deactivatedAt: users.deactivatedAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(users.createdAt);
  }

  async createUser(
    input: CreateUserInput & { username: string; title?: string },
    actor?: AuditActor,
  ) {
    const existing = await this.databaseService.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, input.email.toLowerCase()))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException(
        'CORREO_DUPLICADO: Ya existe un usuario con este correo electrónico',
      );
    }

    const passwordHash = await this.passwordService.hash(input.password);

    const [created] = await this.databaseService.db
      .insert(users)
      .values({
        username: input.username.toLowerCase(),
        email: input.email.toLowerCase(),
        fullName: input.fullName,
        title: input.title || '',
        role: input.role,
        passwordHash,
      })
      .returning({
        id: users.id,
        username: users.username,
        email: users.email,
        fullName: users.fullName,
        title: users.title,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
      });

    if (actor) {
      await this.auditService.recordEvent({
        userId: actor.userId,
        userEmail: actor.userEmail,
        userRole: actor.userRole,
        action: 'CREACION_USUARIO',
        entity: 'users',
        entityId: created.id,
        oldValues: null,
        newValues: {
          username: created.username,
          email: created.email,
          fullName: created.fullName,
          title: created.title,
          role: created.role,
        },
        ipAddress: actor.ipAddress,
      });
    }

    return created;
  }

  async updateUser(userId: string, input: UpdateUserInput, actor: AuditActor) {
    const [target] = await this.databaseService.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!target) {
      throw new NotFoundException('USUARIO_NO_ENCONTRADO: El ID de usuario no existe');
    }

    const normalizedEmail = input.email ? input.email.toLowerCase() : undefined;
    const nextUsername = normalizedEmail ? normalizedEmail.split('@')[0] : undefined;

    if (normalizedEmail || nextUsername) {
      const duplicate = await this.databaseService.db
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            ne(users.id, userId),
            or(
              normalizedEmail ? eq(users.email, normalizedEmail) : undefined,
              nextUsername ? eq(users.username, nextUsername) : undefined,
            ),
          ),
        )
        .limit(1);

      if (duplicate.length > 0) {
        throw new ConflictException(
          'USUARIO_DUPLICADO: El correo o nombre de usuario ya está registrado',
        );
      }
    }

    if (actor.userId === userId && input.role && input.role !== target.role) {
      throw new ForbiddenException(
        'CAMBIO_ROL_PROPIO_NO_PERMITIDO: No puede cambiar su propio rol',
      );
    }

    if (target.role === UserRole.ADMIN && input.role && input.role !== UserRole.ADMIN) {
      await this.assertNotLastActiveAdmin(target.id);
    }

    const [updated] = await this.databaseService.db
      .update(users)
      .set({
        ...(normalizedEmail ? { email: normalizedEmail } : {}),
        ...(nextUsername ? { username: nextUsername } : {}),
        ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.role !== undefined ? { role: input.role } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        username: users.username,
        email: users.email,
        fullName: users.fullName,
        title: users.title,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
      });

    await this.auditService.recordEvent({
      userId: actor.userId,
      userEmail: actor.userEmail,
      userRole: actor.userRole,
      action: 'ACTUALIZACION_USUARIO',
      entity: 'users',
      entityId: userId,
      oldValues: {
        email: target.email,
        username: target.username,
        fullName: target.fullName,
        title: target.title,
        role: target.role,
      },
      newValues: {
        email: updated.email,
        username: updated.username,
        fullName: updated.fullName,
        title: updated.title,
        role: updated.role,
      },
      ipAddress: actor.ipAddress,
    });

    return updated;
  }

  async deactivateUser(userId: string, actor: AuditActor) {
    const [target] = await this.databaseService.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!target) {
      throw new NotFoundException('USUARIO_NO_ENCONTRADO: El ID de usuario no existe');
    }

    if (actor.userId === userId) {
      throw new ForbiddenException(
        'AUTODESACTIVACION_NO_PERMITIDA: No puede desactivar su propia cuenta',
      );
    }

    if (!target.isActive) {
      throw new ConflictException('USUARIO_YA_INACTIVO: La cuenta ya está desactivada');
    }

    if (target.role === UserRole.ADMIN) {
      await this.assertNotLastActiveAdmin(target.id);
    }

    await this.databaseService.db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ isActive: false, deactivatedAt: new Date(), updatedAt: new Date() })
        .where(eq(users.id, userId));

      await tx
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));

      await this.auditService.recordEvent(
        {
          userId: actor.userId,
          userEmail: actor.userEmail,
          userRole: actor.userRole,
          action: 'DESACTIVACION_USUARIO',
          entity: 'users',
          entityId: userId,
          oldValues: { isActive: true, role: target.role, email: target.email },
          newValues: { isActive: false, deactivatedAt: new Date().toISOString() },
          ipAddress: actor.ipAddress,
        },
        tx,
      );
    });

    return { message: 'USUARIO_DESACTIVADO_EXITOSAMENTE', userId };
  }

  async reactivateUser(userId: string, actor: AuditActor) {
    const [target] = await this.databaseService.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!target) {
      throw new NotFoundException('USUARIO_NO_ENCONTRADO: El ID de usuario no existe');
    }

    if (target.isActive) {
      throw new ConflictException('USUARIO_YA_ACTIVO: La cuenta ya está activa');
    }

    const [reactivated] = await this.databaseService.db
      .update(users)
      .set({
        isActive: true,
        deactivatedAt: null,
        failedAttempts: 0,
        isLocked: false,
        lockoutExpiresAt: null,
        permanentLock: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        username: users.username,
        email: users.email,
        fullName: users.fullName,
        title: users.title,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
      });

    await this.auditService.recordEvent({
      userId: actor.userId,
      userEmail: actor.userEmail,
      userRole: actor.userRole,
      action: 'REACTIVACION_USUARIO',
      entity: 'users',
      entityId: userId,
      oldValues: { isActive: false, role: target.role, email: target.email },
      newValues: { isActive: true, role: reactivated.role, email: reactivated.email },
      ipAddress: actor.ipAddress,
    });

    return reactivated;
  }

  async unlockUser(userId: string, actor?: AuditActor) {
    const [user] = await this.databaseService.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException('USUARIO_NO_ENCONTRADO: El ID de usuario no existe');
    }

    await this.databaseService.db
      .update(users)
      .set({
        failedAttempts: 0,
        isLocked: false,
        lockoutExpiresAt: null,
        permanentLock: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    if (actor) {
      await this.auditService.recordEvent({
        userId: actor.userId,
        userEmail: actor.userEmail,
        userRole: actor.userRole,
        action: 'DESBLOQUEO_USUARIO',
        entity: 'users',
        entityId: userId,
        oldValues: {
          failedAttempts: user.failedAttempts,
          isLocked: user.isLocked,
          permanentLock: user.permanentLock,
        },
        newValues: { failedAttempts: 0, isLocked: false, permanentLock: false },
        ipAddress: actor.ipAddress,
      });
    }

    return { message: 'USUARIO_DESBLOQUEADO_EXITOSAMENTE', userId };
  }

  async resetAttempts(userId: string, actor?: AuditActor) {
    const [user] = await this.databaseService.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException('USUARIO_NO_ENCONTRADO: El ID de usuario no existe');
    }

    await this.databaseService.db
      .update(users)
      .set({
        failedAttempts: 0,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    if (actor) {
      await this.auditService.recordEvent({
        userId: actor.userId,
        userEmail: actor.userEmail,
        userRole: actor.userRole,
        action: 'REINICIO_INTENTOS',
        entity: 'users',
        entityId: userId,
        oldValues: { failedAttempts: user.failedAttempts },
        newValues: { failedAttempts: 0 },
        ipAddress: actor.ipAddress,
      });
    }

    return { message: 'INTENTOS_REINICIADOS', userId };
  }

  private async assertNotLastActiveAdmin(targetUserId: string) {
    const [row] = await this.databaseService.db
      .select({ total: count() })
      .from(users)
      .where(and(eq(users.role, UserRole.ADMIN), eq(users.isActive, true)));

    const total = Number(row?.total ?? 0);
    const [target] = await this.databaseService.db
      .select({ isActive: users.isActive })
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);

    if (total <= 1 && target?.isActive) {
      throw new BadRequestException(
        'ULTIMO_ADMIN_ACTIVO: No se puede dejar el sistema sin un administrador activo',
      );
    }
  }
}
