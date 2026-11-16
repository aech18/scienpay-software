import type { Request } from 'express';
import type { AuditActor } from '../../modules/audit/audit.service.js';

export type AuthenticatedRequest = Request & {
  user?: { id?: string; email?: string; role?: string; fullName?: string };
};

export function buildAuditActor(req: AuthenticatedRequest): AuditActor {
  return {
    userId: req.user?.id ?? null,
    userEmail: req.user?.email ?? '',
    userRole: req.user?.role ?? '',
    ipAddress: req.ip || req.socket?.remoteAddress || 'unknown',
  };
}
