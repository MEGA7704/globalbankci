-- GLOBAL BANK V9 — RBAC, demandes de correction et journalisation renforcée
-- Les ajouts de colonnes sur une base V8 sont appliqués de manière idempotente
-- par ensureSchema() dans public/_worker.js afin d'éviter l'échec d'une migration
-- si le Worker a déjà préparé la base.

CREATE TABLE IF NOT EXISTS operation_requests (
  id TEXT PRIMARY KEY,
  bank_id TEXT NOT NULL,
  movement_id TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  requested_by_name TEXT DEFAULT '',
  requested_by_role TEXT NOT NULL,
  request_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by TEXT DEFAULT '',
  reviewed_at TEXT DEFAULT '',
  review_note TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_operation_requests_bank
  ON operation_requests(bank_id, created_at);
CREATE INDEX IF NOT EXISTS idx_operation_requests_user
  ON operation_requests(bank_id, requested_by, created_at);
