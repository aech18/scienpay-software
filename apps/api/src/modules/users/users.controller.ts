import { Body, Controller, Delete, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import {
  UserRole,
  createUserSchema,
  updateUserSchema,
  type CreateUserInput,
  type UpdateUserInput,
} from '@scienpay/shared';
import { UsersService } from './users.service.js';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard.js';
import { RolesGuard } from '../../infrastructure/auth/roles.guard.js';
import { Roles } from '../../infrastructure/auth/roles.decorator.js';
import {
  buildAuditActor,
  type AuthenticatedRequest,
} from '../../infrastructure/auth/audit-actor.js';
import { ZodValidationPipe } from '../../infrastructure/validation/zod-validation.pipe.js';
import { UuidParam } from '../../infrastructure/validation/uuid-param.decorator.js';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async listUsers() {
    return this.usersService.listUsers();
  }

  @Post()
  async createUser(
    @Body(new ZodValidationPipe(createUserSchema)) body: CreateUserInput,
    @Req() req: AuthenticatedRequest,
  ) {
    const username = body.email.split('@')[0];
    return this.usersService.createUser({ ...body, username }, buildAuditActor(req));
  }

  @Patch(':id/unlock')
  async unlockUser(@UuidParam() id: string, @Req() req: AuthenticatedRequest) {
    return this.usersService.unlockUser(id, buildAuditActor(req));
  }

  @Patch(':id/reset-attempts')
  async resetAttempts(@UuidParam() id: string, @Req() req: AuthenticatedRequest) {
    return this.usersService.resetAttempts(id, buildAuditActor(req));
  }

  @Patch(':id/reactivate')
  async reactivateUser(@UuidParam() id: string, @Req() req: AuthenticatedRequest) {
    return this.usersService.reactivateUser(id, buildAuditActor(req));
  }

  @Patch(':id')
  async updateUser(
    @UuidParam() id: string,
    @Body(new ZodValidationPipe(updateUserSchema)) body: UpdateUserInput,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usersService.updateUser(id, body, buildAuditActor(req));
  }

  @Delete(':id')
  async deactivateUser(@UuidParam() id: string, @Req() req: AuthenticatedRequest) {
    return this.usersService.deactivateUser(id, buildAuditActor(req));
  }
}
