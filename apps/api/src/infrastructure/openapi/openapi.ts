import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import {
  auditQuerySchema,
  annulCausationBatchSchema,
  baseProjectSchema,
  createAssignmentSchema,
  createPaymentGroupSchema,
  createPaymentRequestSchema,
  createPersonSchema,
  createPettyCashSchema,
  createUserSchema,
  generateCausationBatchSchema,
  loginSchema,
  openPettyCashPeriodSchema,
  rejectPaymentRequestSchema,
  registerDisbursementSchema,
  renderPettyCashVoucherSchema,
  requestPettyCashVoucherSchema,
  terminateAssignmentSchema,
  updatePersonSchema,
  updateProjectSchema,
} from '@scienpay/shared';

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

const errorSchema = z.object({ statusCode: z.number(), message: z.any() });

const errorResponse = {
  description: 'Error de validación o de negocio',
  content: {
    'application/json': {
      schema: errorSchema,
    },
  },
};

const jsonBody = (schema: z.ZodTypeAny) => ({
  required: true,
  content: { 'application/json': { schema } },
});

const bearerAuth = [{ bearerAuth: [] }];

const userUpdateSchema = createUserSchema.omit({ password: true }).partial();

registry.register('ErrorResponse', errorSchema);

registry.register('LoginInput', loginSchema);
registry.register('CreateUserInput', createUserSchema);
registry.register('UpdateUserInput', userUpdateSchema);
registry.register('CreateProjectInput', baseProjectSchema);
registry.register('UpdateProjectInput', updateProjectSchema);
registry.register('CreatePersonInput', createPersonSchema);
registry.register('UpdatePersonInput', updatePersonSchema);
registry.register('CreatePaymentGroupInput', createPaymentGroupSchema);
registry.register('CreateAssignmentInput', createAssignmentSchema);
registry.register('TerminateAssignmentInput', terminateAssignmentSchema);
registry.register('GenerateCausationBatchInput', generateCausationBatchSchema);
registry.register('AnnulCausationBatchInput', annulCausationBatchSchema);
registry.register('CreatePaymentRequestInput', createPaymentRequestSchema);
registry.register('RejectPaymentRequestInput', rejectPaymentRequestSchema);
registry.register('RegisterDisbursementInput', registerDisbursementSchema);
registry.register('CreatePettyCashInput', createPettyCashSchema);
registry.register('OpenPettyCashPeriodInput', openPettyCashPeriodSchema);
registry.register('RequestPettyCashVoucherInput', requestPettyCashVoucherSchema);
registry.register('RenderPettyCashVoucherInput', renderPettyCashVoucherSchema);
registry.register('AuditQueryInput', auditQuerySchema);

registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

registry.registerPath({
  method: 'get',
  path: '/health',
  tags: ['Health'],
  summary: 'Estado del servicio',
  responses: { 200: { description: 'Servicio operativo' } },
});

registry.registerPath({
  method: 'post',
  path: '/auth/login',
  tags: ['Autenticación'],
  summary: 'Iniciar sesión',
  request: { body: jsonBody(loginSchema) },
  responses: {
    200: { description: 'Sesión iniciada; access token y cookie de refresh' },
    401: errorResponse,
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/refresh',
  tags: ['Autenticación'],
  summary: 'Renovar access token',
  responses: { 200: { description: 'Token renovado' }, 401: errorResponse },
});

registry.registerPath({
  method: 'post',
  path: '/auth/logout',
  tags: ['Autenticación'],
  summary: 'Cerrar sesión',
  responses: { 200: { description: 'Sesión cerrada' } },
});

registry.registerPath({
  method: 'get',
  path: '/auth/me',
  tags: ['Autenticación'],
  summary: 'Perfil autenticado',
  security: bearerAuth,
  responses: { 200: { description: 'Usuario autenticado' }, 401: errorResponse },
});

registry.registerPath({
  method: 'get',
  path: '/users',
  tags: ['Usuarios'],
  summary: 'Listar usuarios',
  security: bearerAuth,
  responses: { 200: { description: 'Listado de usuarios' } },
});

registry.registerPath({
  method: 'post',
  path: '/users',
  tags: ['Usuarios'],
  summary: 'Crear usuario',
  security: bearerAuth,
  request: { body: jsonBody(createUserSchema) },
  responses: { 201: { description: 'Usuario creado' }, 400: errorResponse },
});

registry.registerPath({
  method: 'patch',
  path: '/users/{id}',
  tags: ['Usuarios'],
  summary: 'Actualizar usuario',
  security: bearerAuth,
  request: { params: z.object({ id: z.string().uuid() }), body: jsonBody(userUpdateSchema) },
  responses: { 200: { description: 'Usuario actualizado' }, 400: errorResponse },
});

registry.registerPath({
  method: 'delete',
  path: '/users/{id}',
  tags: ['Usuarios'],
  summary: 'Desactivar usuario (baja lógica)',
  security: bearerAuth,
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: { 200: { description: 'Usuario desactivado' }, 409: errorResponse },
});

registry.registerPath({
  method: 'patch',
  path: '/users/{id}/reactivate',
  tags: ['Usuarios'],
  summary: 'Reactivar usuario',
  security: bearerAuth,
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: { 200: { description: 'Usuario reactivado' } },
});

registry.registerPath({
  method: 'patch',
  path: '/users/{id}/unlock',
  tags: ['Usuarios'],
  summary: 'Desbloquear cuenta',
  security: bearerAuth,
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: { 200: { description: 'Cuenta desbloqueada' } },
});

registry.registerPath({
  method: 'patch',
  path: '/users/{id}/reset-attempts',
  tags: ['Usuarios'],
  summary: 'Reiniciar intentos fallidos',
  security: bearerAuth,
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: { 200: { description: 'Intentos reiniciados' } },
});

registry.registerPath({
  method: 'get',
  path: '/projects',
  tags: ['Proyectos'],
  summary: 'Listar proyectos',
  security: bearerAuth,
  responses: { 200: { description: 'Listado de proyectos' } },
});

registry.registerPath({
  method: 'get',
  path: '/projects/{id}',
  tags: ['Proyectos'],
  summary: 'Obtener proyecto',
  security: bearerAuth,
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: { 200: { description: 'Proyecto' }, 404: errorResponse },
});

registry.registerPath({
  method: 'post',
  path: '/projects',
  tags: ['Proyectos'],
  summary: 'Crear proyecto',
  security: bearerAuth,
  request: { body: jsonBody(baseProjectSchema) },
  responses: { 201: { description: 'Proyecto creado' }, 400: errorResponse },
});

registry.registerPath({
  method: 'patch',
  path: '/projects/{id}',
  tags: ['Proyectos'],
  summary: 'Actualizar proyecto',
  security: bearerAuth,
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: jsonBody(updateProjectSchema),
  },
  responses: { 200: { description: 'Proyecto actualizado' } },
});

registry.registerPath({
  method: 'get',
  path: '/persons',
  tags: ['Personas'],
  summary: 'Listar personas',
  security: bearerAuth,
  responses: { 200: { description: 'Listado de personas' } },
});

registry.registerPath({
  method: 'get',
  path: '/persons/{id}',
  tags: ['Personas'],
  summary: 'Obtener persona',
  security: bearerAuth,
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: { 200: { description: 'Persona' }, 404: errorResponse },
});

registry.registerPath({
  method: 'post',
  path: '/persons',
  tags: ['Personas'],
  summary: 'Crear persona',
  security: bearerAuth,
  request: { body: jsonBody(createPersonSchema) },
  responses: { 201: { description: 'Persona creada' } },
});

registry.registerPath({
  method: 'patch',
  path: '/persons/{id}',
  tags: ['Personas'],
  summary: 'Actualizar persona',
  security: bearerAuth,
  request: { params: z.object({ id: z.string().uuid() }), body: jsonBody(updatePersonSchema) },
  responses: { 200: { description: 'Persona actualizada' } },
});

registry.registerPath({
  method: 'get',
  path: '/payment-groups',
  tags: ['Grupos de pago'],
  summary: 'Listar grupos de pago',
  security: bearerAuth,
  responses: { 200: { description: 'Listado de grupos' } },
});

registry.registerPath({
  method: 'get',
  path: '/payment-groups/{id}',
  tags: ['Grupos de pago'],
  summary: 'Obtener grupo de pago',
  security: bearerAuth,
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: { 200: { description: 'Grupo de pago' }, 404: errorResponse },
});

registry.registerPath({
  method: 'post',
  path: '/payment-groups',
  tags: ['Grupos de pago'],
  summary: 'Crear grupo de pago',
  security: bearerAuth,
  request: { body: jsonBody(createPaymentGroupSchema) },
  responses: { 201: { description: 'Grupo creado' } },
});

registry.registerPath({
  method: 'get',
  path: '/assignments',
  tags: ['Asignaciones'],
  summary: 'Listar asignaciones',
  security: bearerAuth,
  responses: { 200: { description: 'Listado de asignaciones' } },
});

registry.registerPath({
  method: 'get',
  path: '/assignments/{id}',
  tags: ['Asignaciones'],
  summary: 'Obtener asignación',
  security: bearerAuth,
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: { 200: { description: 'Asignación' }, 404: errorResponse },
});

registry.registerPath({
  method: 'post',
  path: '/assignments',
  tags: ['Asignaciones'],
  summary: 'Crear asignación',
  security: bearerAuth,
  request: { body: jsonBody(createAssignmentSchema) },
  responses: { 201: { description: 'Asignación creada' }, 409: errorResponse },
});

registry.registerPath({
  method: 'patch',
  path: '/assignments/{id}/terminate',
  tags: ['Asignaciones'],
  summary: 'Terminar asignación',
  security: bearerAuth,
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: jsonBody(terminateAssignmentSchema),
  },
  responses: { 200: { description: 'Asignación terminada' } },
});

registry.registerPath({
  method: 'post',
  path: '/causation/preview',
  tags: ['Causación'],
  summary: 'Previsualizar causación',
  security: bearerAuth,
  request: { body: jsonBody(generateCausationBatchSchema) },
  responses: { 200: { description: 'Previsualización de causación' } },
});

registry.registerPath({
  method: 'post',
  path: '/causation/generate',
  tags: ['Causación'],
  summary: 'Generar lote de causación',
  security: bearerAuth,
  request: { body: jsonBody(generateCausationBatchSchema) },
  responses: { 201: { description: 'Lote generado' }, 409: errorResponse },
});

registry.registerPath({
  method: 'get',
  path: '/causation/batches',
  tags: ['Causación'],
  summary: 'Listar lotes de causación',
  security: bearerAuth,
  responses: { 200: { description: 'Listado de lotes' } },
});

registry.registerPath({
  method: 'get',
  path: '/causation/batches/{id}',
  tags: ['Causación'],
  summary: 'Obtener lote de causación',
  security: bearerAuth,
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: { 200: { description: 'Lote de causación' }, 404: errorResponse },
});

registry.registerPath({
  method: 'post',
  path: '/causation/batches/{id}/annul',
  tags: ['Causación'],
  summary: 'Anular lote de causación',
  security: bearerAuth,
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: jsonBody(annulCausationBatchSchema),
  },
  responses: { 200: { description: 'Lote anulado' }, 409: errorResponse },
});

registry.registerPath({
  method: 'get',
  path: '/payment-requests',
  tags: ['Solicitudes de pago'],
  summary: 'Listar solicitudes',
  security: bearerAuth,
  request: { query: z.object({ projectId: z.string().uuid().optional() }) },
  responses: { 200: { description: 'Listado de solicitudes' } },
});

registry.registerPath({
  method: 'get',
  path: '/payment-requests/{id}',
  tags: ['Solicitudes de pago'],
  summary: 'Obtener solicitud',
  security: bearerAuth,
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: { 200: { description: 'Solicitud' }, 404: errorResponse },
});

registry.registerPath({
  method: 'get',
  path: '/payment-requests/{id}/pdf',
  tags: ['Solicitudes de pago'],
  summary: 'Descargar PDF de solicitud',
  security: bearerAuth,
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: { 200: { description: 'PDF de la solicitud' } },
});

registry.registerPath({
  method: 'post',
  path: '/payment-requests',
  tags: ['Solicitudes de pago'],
  summary: 'Crear solicitud',
  security: bearerAuth,
  request: { body: jsonBody(createPaymentRequestSchema) },
  responses: { 201: { description: 'Solicitud creada' }, 409: errorResponse },
});

registry.registerPath({
  method: 'patch',
  path: '/payment-requests/{id}/send',
  tags: ['Solicitudes de pago'],
  summary: 'Enviar solicitud',
  security: bearerAuth,
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: { 200: { description: 'Solicitud enviada' }, 409: errorResponse },
});

registry.registerPath({
  method: 'patch',
  path: '/payment-requests/{id}/approve',
  tags: ['Solicitudes de pago'],
  summary: 'Aprobar solicitud',
  security: bearerAuth,
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: { 200: { description: 'Solicitud aprobada' }, 409: errorResponse },
});

registry.registerPath({
  method: 'patch',
  path: '/payment-requests/{id}/reject',
  tags: ['Solicitudes de pago'],
  summary: 'Rechazar solicitud',
  security: bearerAuth,
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: jsonBody(rejectPaymentRequestSchema),
  },
  responses: { 200: { description: 'Solicitud rechazada' } },
});

registry.registerPath({
  method: 'patch',
  path: '/payment-requests/{id}/close',
  tags: ['Solicitudes de pago'],
  summary: 'Cerrar solicitud',
  security: bearerAuth,
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: { 200: { description: 'Solicitud cerrada' }, 409: errorResponse },
});

registry.registerPath({
  method: 'get',
  path: '/disbursements',
  tags: ['Desembolsos'],
  summary: 'Listar desembolsos',
  security: bearerAuth,
  request: { query: z.object({ requestId: z.string().uuid().optional() }) },
  responses: { 200: { description: 'Listado de desembolsos' } },
});

registry.registerPath({
  method: 'get',
  path: '/disbursements/receipts',
  tags: ['Desembolsos'],
  summary: 'Listar recibos',
  security: bearerAuth,
  request: { query: z.object({ personId: z.string().uuid().optional() }) },
  responses: { 200: { description: 'Listado de recibos' } },
});

registry.registerPath({
  method: 'get',
  path: '/disbursements/receipts/{id}',
  tags: ['Desembolsos'],
  summary: 'Obtener recibo',
  security: bearerAuth,
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: { 200: { description: 'Recibo' }, 404: errorResponse },
});

registry.registerPath({
  method: 'get',
  path: '/disbursements/receipts/{id}/pdf',
  tags: ['Desembolsos'],
  summary: 'Descargar PDF de recibo',
  security: bearerAuth,
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: { 200: { description: 'PDF del recibo' } },
});

registry.registerPath({
  method: 'post',
  path: '/disbursements',
  tags: ['Desembolsos'],
  summary: 'Registrar desembolso',
  security: bearerAuth,
  request: { body: jsonBody(registerDisbursementSchema) },
  responses: { 201: { description: 'Desembolso registrado' }, 409: errorResponse },
});

registry.registerPath({
  method: 'get',
  path: '/petty-cash',
  tags: ['Caja chica'],
  summary: 'Listar cajas chicas',
  security: bearerAuth,
  responses: { 200: { description: 'Listado de cajas chicas' } },
});

registry.registerPath({
  method: 'get',
  path: '/petty-cash/{id}/periods',
  tags: ['Caja chica'],
  summary: 'Listar períodos',
  security: bearerAuth,
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: { 200: { description: 'Períodos de la caja' } },
});

registry.registerPath({
  method: 'get',
  path: '/petty-cash/periods/{periodId}/vouchers',
  tags: ['Caja chica'],
  summary: 'Listar vales',
  security: bearerAuth,
  request: { params: z.object({ periodId: z.string().uuid() }) },
  responses: { 200: { description: 'Vales del período' } },
});

registry.registerPath({
  method: 'post',
  path: '/petty-cash',
  tags: ['Caja chica'],
  summary: 'Crear caja chica',
  security: bearerAuth,
  request: { body: jsonBody(createPettyCashSchema) },
  responses: { 201: { description: 'Caja chica creada' } },
});

registry.registerPath({
  method: 'post',
  path: '/petty-cash/{id}/periods',
  tags: ['Caja chica'],
  summary: 'Abrir período',
  security: bearerAuth,
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: jsonBody(openPettyCashPeriodSchema),
  },
  responses: { 201: { description: 'Período abierto' }, 409: errorResponse },
});

registry.registerPath({
  method: 'post',
  path: '/petty-cash/periods/{periodId}/vouchers',
  tags: ['Caja chica'],
  summary: 'Solicitar vale',
  security: bearerAuth,
  request: {
    params: z.object({ periodId: z.string().uuid() }),
    body: jsonBody(requestPettyCashVoucherSchema),
  },
  responses: { 201: { description: 'Vale solicitado' } },
});

registry.registerPath({
  method: 'patch',
  path: '/petty-cash/vouchers/{id}/approve',
  tags: ['Caja chica'],
  summary: 'Aprobar vale',
  security: bearerAuth,
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: { 200: { description: 'Vale aprobado' } },
});

registry.registerPath({
  method: 'patch',
  path: '/petty-cash/vouchers/{id}/disburse',
  tags: ['Caja chica'],
  summary: 'Desembolsar vale',
  security: bearerAuth,
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: { 200: { description: 'Vale desembolsado' }, 409: errorResponse },
});

registry.registerPath({
  method: 'patch',
  path: '/petty-cash/vouchers/{id}/render',
  tags: ['Caja chica'],
  summary: 'Rendir vale',
  security: bearerAuth,
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: jsonBody(renderPettyCashVoucherSchema),
  },
  responses: { 200: { description: 'Vale rendido' }, 409: errorResponse },
});

registry.registerPath({
  method: 'patch',
  path: '/petty-cash/periods/{periodId}/close',
  tags: ['Caja chica'],
  summary: 'Cerrar período',
  security: bearerAuth,
  request: { params: z.object({ periodId: z.string().uuid() }) },
  responses: { 200: { description: 'Período cerrado' }, 409: errorResponse },
});

registry.registerPath({
  method: 'get',
  path: '/audit',
  tags: ['Auditoría'],
  summary: 'Consultar bitácora de auditoría',
  security: bearerAuth,
  request: { query: auditQuerySchema },
  responses: { 200: { description: 'Eventos de auditoría paginados' } },
});

export function buildOpenApiDocument() {
  const generator = new OpenApiGeneratorV3(registry.definitions);

  return generator.generateDocument({
    openapi: '3.0.3',
    info: {
      title: 'Scienpay API',
      version: '1.0.0',
      description:
        'API de gestión de nómina, causación, solicitudes de pago, desembolsos y caja chica.',
    },
    servers: [{ url: '/api/v1', description: 'Servidor actual' }],
    tags: [
      { name: 'Autenticación' },
      { name: 'Usuarios' },
      { name: 'Proyectos' },
      { name: 'Personas' },
      { name: 'Grupos de pago' },
      { name: 'Asignaciones' },
      { name: 'Causación' },
      { name: 'Solicitudes de pago' },
      { name: 'Desembolsos' },
      { name: 'Caja chica' },
      { name: 'Auditoría' },
    ],
  });
}
