-- ============================================================================
-- Migración 0004: baja lógica de usuarios e índices de auditoría
-- Idempotente: migrate.ts reaplica todos los archivos .sql en cada arranque.
-- ============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity_action_created
  ON audit_log(entity, action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at
  ON audit_log(created_at DESC);
