import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { UserRole, createPaymentGroupSchema, type CreatePaymentGroupInput } from '@scienpay/shared';
import { PaymentGroupsService } from './payment-groups.service.js';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard.js';
import { RolesGuard } from '../../infrastructure/auth/roles.guard.js';
import { Roles } from '../../infrastructure/auth/roles.decorator.js';
import { ZodValidationPipe } from '../../infrastructure/validation/zod-validation.pipe.js';
import { UuidParam } from '../../infrastructure/validation/uuid-param.decorator.js';
import {
  buildAuditActor,
  type AuthenticatedRequest,
} from '../../infrastructure/auth/audit-actor.js';

@Controller('payment-groups')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentGroupsController {
  constructor(private readonly paymentGroupsService: PaymentGroupsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.GENERADOR, UserRole.RECEPTOR)
  async listPaymentGroups() {
    return this.paymentGroupsService.listPaymentGroups();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.GENERADOR, UserRole.RECEPTOR)
  async getPaymentGroupById(@UuidParam() id: string) {
    return this.paymentGroupsService.getPaymentGroupById(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.GENERADOR)
  async createPaymentGroup(
    @Body(new ZodValidationPipe(createPaymentGroupSchema)) body: CreatePaymentGroupInput,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.paymentGroupsService.createPaymentGroup(body, buildAuditActor(req));
  }
}
