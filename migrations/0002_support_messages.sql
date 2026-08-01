-- GLOBAL BANK V6 — messagerie interne sécurisée
CREATE TABLE IF NOT EXISTS support_messages (
  id TEXT PRIMARY KEY,
  broadcast_id TEXT DEFAULT '',
  sender_type TEXT NOT NULL,
  sender_bank_id TEXT DEFAULT '',
  recipient_bank_id TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'message',
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  bank_read_at TEXT DEFAULT '',
  super_read_at TEXT DEFAULT '',
  deleted_by_bank INTEGER NOT NULL DEFAULT 0,
  deleted_by_super INTEGER NOT NULL DEFAULT 0,
  created_by TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_support_messages_bank ON support_messages(recipient_bank_id, created_at);
CREATE INDEX IF NOT EXISTS idx_support_messages_super ON support_messages(deleted_by_super, created_at);
CREATE INDEX IF NOT EXISTS idx_support_messages_broadcast ON support_messages(broadcast_id);
