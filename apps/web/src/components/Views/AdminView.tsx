import React, { useState } from 'react';
import {
  Users,
  Sliders,
  FileText,
  ShieldCheck,
  ShieldAlert,
  Unlock,
  AlertCircle,
  Database,
  Lock,
  RotateCcw,
  Plus,
  Filter,
  Pencil,
  UserX,
  UserCheck,
} from 'lucide-react';
import {
  useDeactivateUser,
  useReactivateUser,
  useResetUserAttempts,
  useUnlockUser,
  useUsers,
} from '../../hooks/useUsers.js';
import { useAuditLogs } from '../../hooks/useAudit.js';
import { useToast } from '../../context/ToastContext.js';
import { getApiErrorMessage } from '../../lib/apiClient.js';
import { formatDateTime } from '../../lib/format.js';
import type { AuditFilters, UserAccount } from '../../types/api.types.js';
import { PageHeader, SectionBanner } from '../ui/PageHeader.js';
import { EmptyState, ErrorState, LoadingState, StatusBadge, statusTone } from '../ui/Feedback.js';
import { Button, TextInput } from '../ui/FormControls.js';
import { Modal } from '../ui/Modal.js';
import { UserForm } from '../Forms/UserForm.js';

interface AdminViewProps {
  activeTab: string;
}

export const AdminView: React.FC<AdminViewProps> = ({ activeTab }) => {
  const { showToast } = useToast();
  const usersQuery = useUsers();
  const unlockUser = useUnlockUser();
  const resetAttempts = useResetUserAttempts();
  const deactivateUser = useDeactivateUser();
  const reactivateUser = useReactivateUser();

  const [showCreateUser, setShowCreateUser] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [draftFilters, setDraftFilters] = useState({
    entity: '',
    action: '',
    dateFrom: '',
    dateTo: '',
  });
  const [auditFilters, setAuditFilters] = useState<AuditFilters>({ page: 1, limit: 25 });
  const auditQuery = useAuditLogs(auditFilters);

  const handleUnlock = async (id: string, username: string) => {
    try {
      await unlockUser.mutateAsync(id);
      showToast(`Cuenta ${username} desbloqueada`, 'success');
    } catch (error) {
      showToast(getApiErrorMessage(error), 'error');
    }
  };

  const handleReset = async (id: string, username: string) => {
    try {
      await resetAttempts.mutateAsync(id);
      showToast(`Intentos de ${username} reiniciados`, 'success');
    } catch (error) {
      showToast(getApiErrorMessage(error), 'error');
    }
  };

  const handleDeactivate = async (id: string, username: string) => {
    if (!window.confirm(`¿Desactivar la cuenta ${username}? El usuario no podrá iniciar sesión.`)) {
      return;
    }
    try {
      await deactivateUser.mutateAsync(id);
      showToast(`Cuenta ${username} desactivada`, 'success');
    } catch (error) {
      showToast(getApiErrorMessage(error), 'error');
    }
  };

  const handleReactivate = async (id: string, username: string) => {
    try {
      await reactivateUser.mutateAsync(id);
      showToast(`Cuenta ${username} reactivada`, 'success');
    } catch (error) {
      showToast(getApiErrorMessage(error), 'error');
    }
  };

  const applyFilters = (event: React.FormEvent) => {
    event.preventDefault();
    setAuditFilters({
      entity: draftFilters.entity.trim() || undefined,
      action: draftFilters.action.trim() || undefined,
      dateFrom: draftFilters.dateFrom || undefined,
      dateTo: draftFilters.dateTo || undefined,
      page: 1,
      limit: auditFilters.limit ?? 25,
    });
  };

  return (
    <div className="space-y-6">
      <SectionBanner
        tone="amber"
        title="Segregación de Funciones: Perfil Administrador del Sistema"
      >
        El Administrador gestiona usuarios, parámetros y catálogos globales. Por norma de seguridad
        financiera, <strong>no participa en operaciones de dinero</strong> (no formula causaciones,
        no crea solicitudes, no aprueba ni desembolsa fondos).
      </SectionBanner>

      {activeTab === 'usuarios' && (
        <div className="space-y-4">
          <PageHeader
            title="Usuarios, Roles y Control de Seguridad"
            subtitle="Supervisión de cuentas institucionales, intentos de acceso y desbloqueo de usuarios."
            icon={<Users className="w-5 h-5 text-violet dark:text-violet-light" />}
            actions={
              <>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-100 dark:bg-[#2A2A2A] text-slate-700 dark:text-slate-300">
                  {usersQuery.data?.length ?? 0} Cuentas Registradas
                </span>
                <Button size="sm" onClick={() => setShowCreateUser(true)}>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nuevo Usuario</span>
                </Button>
              </>
            }
          />

          {usersQuery.isLoading && <LoadingState message="Cargando usuarios…" />}
          {usersQuery.isError && (
            <ErrorState
              message={getApiErrorMessage(usersQuery.error)}
              onRetry={() => void usersQuery.refetch()}
            />
          )}

          {usersQuery.data && (
            <div className="bg-white dark:bg-[#202020] rounded-xl border border-[#E9E9E7] dark:border-[#2F2F2F] shadow-[0_1px_3px_rgba(0,0,0,0.02)] overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F7F6F3] dark:bg-[#262626] text-[#787774] dark:text-[#9B9A97] font-semibold border-b border-[#E9E9E7] dark:border-[#2F2F2F]">
                  <tr>
                    <th className="py-2.5 px-4">Usuario</th>
                    <th className="py-2.5 px-4">Nombre / Cargo</th>
                    <th className="py-2.5 px-4">Rol Asignado</th>
                    <th className="py-2.5 px-4">Intentos Fallidos</th>
                    <th className="py-2.5 px-4">Estado de Cuenta</th>
                    <th className="py-2.5 px-4 text-right">Acción Administrativa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EDEDEB] dark:divide-[#2F2F2F]">
                  {usersQuery.data.map((user) => {
                    const isTempLocked =
                      user.isLocked &&
                      user.lockoutExpiresAt !== null &&
                      new Date(user.lockoutExpiresAt).getTime() > Date.now();
                    const isBlocked = user.permanentLock;

                    return (
                      <tr
                        key={user.id}
                        data-testid={`user-row-${user.username}`}
                        className="hover:bg-[#FBFBFA] dark:hover:bg-[#252525] transition"
                      >
                        <td className="py-3 px-4 font-medium text-[#37352F] dark:text-white">
                          <div className="flex items-center space-x-2">
                            <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-[#2A2A2A] text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-[10px]">
                              {user.username.charAt(0).toUpperCase()}
                            </div>
                            <span>{user.username}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-[#37352F] dark:text-white">
                          <div className="font-medium">{user.fullName}</div>
                          <div className="text-[10px] text-[#9B9A97]">
                            {user.title || 'Sin cargo'} · {user.email}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge
                            label={user.role}
                            tone={
                              user.role === 'ADMIN'
                                ? 'violet'
                                : user.role === 'GENERADOR'
                                  ? 'blue'
                                  : 'green'
                            }
                          />
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`font-mono text-xs px-2 py-0.5 rounded ${
                              user.failedAttempts === 0
                                ? 'bg-slate-100 dark:bg-[#2A2A2A] text-slate-600 dark:text-slate-300'
                                : user.failedAttempts < 3
                                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                                  : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 font-bold'
                            }`}
                          >
                            {user.failedAttempts} / 4
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {!user.isActive ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-200 dark:bg-[#2A2A2A] text-slate-700 dark:text-slate-300 font-semibold text-[10px]">
                              <UserX className="w-3 h-3" />
                              <span>Desactivado</span>
                            </span>
                          ) : isBlocked ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 font-semibold text-[10px]">
                              <ShieldAlert className="w-3 h-3" />
                              <span>Bloqueado (4to intento)</span>
                            </span>
                          ) : isTempLocked ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-semibold text-[10px]">
                              <Lock className="w-3 h-3" />
                              <span>Espera 5 min (3er intento)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-semibold text-[10px]">
                              <ShieldCheck className="w-3 h-3" />
                              <span>Activa / Operativa</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {!user.isActive ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                data-testid={`reactivate-user-${user.username}`}
                                onClick={() => void handleReactivate(user.id, user.username)}
                                disabled={reactivateUser.isPending}
                              >
                                <UserCheck className="w-3 h-3" />
                                <span>Reactivar</span>
                              </Button>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  data-testid={`edit-user-${user.username}`}
                                  onClick={() => setEditingUser(user)}
                                  disabled={reactivateUser.isPending}
                                >
                                  <Pencil className="w-3 h-3" />
                                  <span>Editar</span>
                                </Button>
                                {isBlocked || user.isLocked ? (
                                  <Button
                                    size="sm"
                                    variant="danger"
                                    data-testid={`unlock-user-${user.username}`}
                                    onClick={() => void handleUnlock(user.id, user.username)}
                                    disabled={unlockUser.isPending}
                                  >
                                    <Unlock className="w-3 h-3" />
                                    <span>Desbloquear Usuario</span>
                                  </Button>
                                ) : user.failedAttempts > 0 ? (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    data-testid={`reset-user-${user.username}`}
                                    onClick={() => void handleReset(user.id, user.username)}
                                    disabled={resetAttempts.isPending}
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                    <span>Reset Intentos</span>
                                  </Button>
                                ) : null}
                                <Button
                                  size="sm"
                                  variant="danger"
                                  data-testid={`deactivate-user-${user.username}`}
                                  onClick={() => void handleDeactivate(user.id, user.username)}
                                  disabled={deactivateUser.isPending}
                                >
                                  <UserX className="w-3 h-3" />
                                  <span>Desactivar</span>
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {usersQuery.data.length === 0 && (
                <EmptyState message="No hay usuarios registrados." />
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'parametros' && (
        <div className="space-y-4">
          <PageHeader
            title="Parámetros Globales del Sistema"
            subtitle="Configuración general de moneda, cálculo financiero y sesiones activas."
            icon={<Sliders className="w-5 h-5 text-primary dark:text-primary-light" />}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white dark:bg-[#202020] p-5 rounded-xl border border-[#E9E9E7] dark:border-[#2F2F2F] shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
              <div className="flex items-center space-x-2 text-primary dark:text-primary-light mb-2">
                <Database className="w-4 h-4" />
                <span className="font-semibold text-xs text-[#37352F] dark:text-white">
                  Moneda de Operación
                </span>
              </div>
              <div className="text-lg font-bold text-[#37352F] dark:text-white">
                Dólares Estadounidenses (USD)
              </div>
              <p className="text-[11px] text-[#787774] dark:text-[#9B9A97] mt-1">
                Todos los presupuestos, asignaciones y desembolsos se registran en dólares sin
                deducciones.
              </p>
            </div>

            <div className="bg-white dark:bg-[#202020] p-5 rounded-xl border border-[#E9E9E7] dark:border-[#2F2F2F] shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
              <div className="flex items-center space-x-2 text-violet dark:text-violet-light mb-2">
                <Sliders className="w-4 h-4" />
                <span className="font-semibold text-xs text-[#37352F] dark:text-white">
                  Criterio de Prorrateo
                </span>
              </div>
              <div className="text-lg font-bold text-[#37352F] dark:text-white">
                2 Decimales (Estándar)
              </div>
              <p className="text-[11px] text-[#787774] dark:text-[#9B9A97] mt-1">
                Cálculo proporcional diario según los días activos de cada asignación dentro del
                período.
              </p>
            </div>

            <div className="bg-white dark:bg-[#202020] p-5 rounded-xl border border-[#E9E9E7] dark:border-[#2F2F2F] shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
              <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 mb-2">
                <Lock className="w-4 h-4" />
                <span className="font-semibold text-xs text-[#37352F] dark:text-white">
                  Política de Acceso
                </span>
              </div>
              <div className="text-lg font-bold text-[#37352F] dark:text-white">
                Sesión de 15 minutos
              </div>
              <p className="text-[11px] text-[#787774] dark:text-[#9B9A97] mt-1">
                Renovación automática durante actividad y bloqueo preventivo ante intentos fallidos.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'auditoria' && (
        <div className="space-y-4">
          <PageHeader
            title="Registro de Auditoría del Sistema"
            subtitle="Historial cronológico de operaciones registradas en el sistema."
            icon={<FileText className="w-5 h-5 text-secondary dark:text-secondary-light" />}
          />

          <form
            onSubmit={applyFilters}
            className="bg-white dark:bg-[#202020] p-4 rounded-xl border border-[#E9E9E7] dark:border-[#2F2F2F] grid grid-cols-1 md:grid-cols-5 gap-3 items-end"
          >
            <div>
              <label className="block text-[10px] font-semibold text-[#787774] dark:text-[#9B9A97] mb-1">
                Entidad
              </label>
              <TextInput
                placeholder="payment_requests"
                value={draftFilters.entity}
                onChange={(event) =>
                  setDraftFilters((current) => ({ ...current, entity: event.target.value }))
                }
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-[#787774] dark:text-[#9B9A97] mb-1">
                Acción
              </label>
              <TextInput
                placeholder="APROBAR_SOLICITUD"
                value={draftFilters.action}
                onChange={(event) =>
                  setDraftFilters((current) => ({ ...current, action: event.target.value }))
                }
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-[#787774] dark:text-[#9B9A97] mb-1">
                Desde
              </label>
              <TextInput
                type="date"
                value={draftFilters.dateFrom}
                onChange={(event) =>
                  setDraftFilters((current) => ({ ...current, dateFrom: event.target.value }))
                }
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-[#787774] dark:text-[#9B9A97] mb-1">
                Hasta
              </label>
              <TextInput
                type="date"
                value={draftFilters.dateTo}
                onChange={(event) =>
                  setDraftFilters((current) => ({ ...current, dateTo: event.target.value }))
                }
              />
            </div>
            <Button type="submit" size="sm">
              <Filter className="w-3.5 h-3.5" />
              <span>Aplicar Filtros</span>
            </Button>
          </form>

          {auditQuery.isLoading && <LoadingState message="Consultando auditoría…" />}
          {auditQuery.isError && (
            <ErrorState
              message={getApiErrorMessage(auditQuery.error)}
              onRetry={() => void auditQuery.refetch()}
            />
          )}

          {auditQuery.data && (
            <>
              <div className="flex items-center justify-between text-[11px] text-[#787774] dark:text-[#9B9A97]">
                <span>
                  {auditQuery.data.total} registro(s) · página {auditQuery.data.page} de{' '}
                  {Math.max(1, auditQuery.data.totalPages)}
                </span>
                <span className="inline-flex items-center space-x-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>Los registros de auditoría no se pueden modificar ni eliminar.</span>
                </span>
              </div>

              <div className="bg-white dark:bg-[#202020] rounded-xl border border-[#E9E9E7] dark:border-[#2F2F2F] shadow-[0_1px_3px_rgba(0,0,0,0.02)] overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F7F6F3] dark:bg-[#262626] text-[#787774] dark:text-[#9B9A97] font-semibold border-b border-[#E9E9E7] dark:border-[#2F2F2F]">
                    <tr>
                      <th className="py-2.5 px-4">Fecha y Hora</th>
                      <th className="py-2.5 px-4">Usuario Responsable</th>
                      <th className="py-2.5 px-4">Rol</th>
                      <th className="py-2.5 px-4">Acción Ejecutada</th>
                      <th className="py-2.5 px-4">Entidad Afectada</th>
                      <th className="py-2.5 px-4">Detalles</th>
                      <th className="py-2.5 px-4">IP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EDEDEB] dark:divide-[#2F2F2F]">
                    {auditQuery.data.data.map((log) => (
                      <tr
                        key={log.id}
                        className="hover:bg-[#FBFBFA] dark:hover:bg-[#252525] transition"
                      >
                        <td className="py-2.5 px-4 font-mono text-[11px] text-[#787774] dark:text-[#9B9A97]">
                          {formatDateTime(log.createdAt)}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-[#37352F] dark:text-white">
                          {log.userEmail || 'Sistema'}
                        </td>
                        <td className="py-2.5 px-4">
                          <StatusBadge
                            label={log.userRole || 'N/A'}
                            tone={statusTone(log.userRole)}
                          />
                        </td>
                        <td className="py-2.5 px-4 font-mono text-[11px] font-semibold text-[#37352F] dark:text-white">
                          {log.action}
                        </td>
                        <td className="py-2.5 px-4 text-[#787774] dark:text-[#9B9A97] font-mono text-[11px]">
                          {log.entity}
                          {log.entityId ? `#${log.entityId.slice(0, 8)}` : ''}
                        </td>
                        <td className="py-2.5 px-4 text-[#787774] dark:text-[#9B9A97] text-[11px] max-w-xs truncate">
                          {log.newValues ? JSON.stringify(log.newValues) : '—'}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-[11px] text-[#9B9A97]">
                          {log.ipAddress || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {auditQuery.data.data.length === 0 && (
                  <EmptyState message="No hay registros que coincidan con los filtros." />
                )}
              </div>

              <div className="flex items-center justify-end space-x-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={(auditQuery.data.page ?? 1) <= 1}
                  onClick={() =>
                    setAuditFilters((current) => ({
                      ...current,
                      page: Math.max(1, (current.page ?? 1) - 1),
                    }))
                  }
                >
                  Anterior
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={(auditQuery.data.page ?? 1) >= Math.max(1, auditQuery.data.totalPages)}
                  onClick={() =>
                    setAuditFilters((current) => ({ ...current, page: (current.page ?? 1) + 1 }))
                  }
                >
                  Siguiente
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      <Modal
        open={showCreateUser}
        title="Registrar Nuevo Usuario"
        subtitle="El nombre de usuario se deriva del correo institucional."
        onClose={() => setShowCreateUser(false)}
      >
        <UserForm onSuccess={() => setShowCreateUser(false)} />
      </Modal>

      <Modal
        open={Boolean(editingUser)}
        title="Editar Usuario"
        subtitle="Actualice los datos de la cuenta. El nombre de usuario se deriva del correo."
        onClose={() => setEditingUser(null)}
      >
        {editingUser && <UserForm user={editingUser} onSuccess={() => setEditingUser(null)} />}
      </Modal>
    </div>
  );
};
