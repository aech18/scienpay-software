import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { AuthService } from './auth.service.js';
import { DatabaseService } from '../database/database.service.js';
import { users } from '../database/schema.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly databaseService: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'NO_AUTORIZADO: Se requiere token de autorización Bearer válido',
      );
    }

    const token = authHeader.substring(7);
    let decoded;
    try {
      decoded = this.authService.verifyAccessToken(token);
    } catch {
      throw new UnauthorizedException(
        'TOKEN_INVALIDO: El token de acceso ha expirado o es inválido',
      );
    }

    const [account] = await this.databaseService.db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        role: users.role,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.id, decoded.id))
      .limit(1);

    if (!account || !account.isActive) {
      throw new UnauthorizedException('USUARIO_INACTIVO: La cuenta no está habilitada');
    }

    request.user = {
      ...decoded,
      email: account.email,
      fullName: account.fullName,
      role: account.role,
    };
    return true;
  }
}
