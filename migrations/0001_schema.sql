-- GLOBAL BANK — schéma initial D1 sécurisé
-- Les colonnes `pass` de banks/users contiennent uniquement des empreintes PBKDF2-SHA256.

CREATE TABLE IF NOT EXISTS banks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  manager TEXT,
  contact TEXT,
  address TEXT,
  email TEXT DEFAULT '',
  slogan TEXT DEFAULT '',
  logo TEXT DEFAULT '',
  stamp TEXT DEFAULT '',
  signature TEXT DEFAULT '',
  primary_color TEXT DEFAULT '#003b3b',
  secondary_color TEXT DEFAULT '#e7ad2f',
  footer_text TEXT DEFAULT 'Document généré automatiquement',
  legal_mentions TEXT DEFAULT '',
  cga_conditions TEXT DEFAULT '',
  currency TEXT DEFAULT 'FCFA',
  country TEXT DEFAULT '',
  city TEXT DEFAULT '',
  login TEXT NOT NULL UNIQUE,
  pass TEXT NOT NULL,
  auth_version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'Actif',
  subscription TEXT NOT NULL DEFAULT 'FREE',
  subscription_started_at TEXT DEFAULT '',
  subscription_expires_at TEXT DEFAULT '',
  subscription_updated_at TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  bank_id TEXT NOT NULL,
  name TEXT NOT NULL,
  contact TEXT,
  job TEXT,
  address TEXT,
  piece TEXT,
  pass TEXT,
  client_type TEXT DEFAULT 'personne_physique',
  client_details TEXT DEFAULT '',
  photo_logo TEXT DEFAULT '',
  is_blocked INTEGER NOT NULL DEFAULT 0,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  bank_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  number TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  balance REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Actif',
  is_blocked INTEGER NOT NULL DEFAULT 0,
  block_reason TEXT DEFAULT '',
  is_deleted INTEGER NOT NULL DEFAULT 0,
  credit_fee REAL DEFAULT 0,
  credit_carnet_fee REAL DEFAULT 0,
  credit_amount REAL DEFAULT 0,
  credit_rate REAL DEFAULT 0,
  credit_duration INTEGER DEFAULT 0,
  credit_monthly REAL DEFAULT 0,
  credit_due_count INTEGER DEFAULT 0,
  credit_penalty_rate REAL DEFAULT 0,
  credit_total REAL DEFAULT 0,
  credit_choice TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS moves (
  id TEXT PRIMARY KEY,
  bank_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  amount REAL NOT NULL,
  balance_after REAL NOT NULL,
  created_by TEXT DEFAULT '',
  created_by_role TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  bank_id TEXT NOT NULL,
  name TEXT,
  login TEXT NOT NULL,
  pass TEXT NOT NULL,
  auth_version INTEGER NOT NULL DEFAULT 1,
  role TEXT,
  status TEXT NOT NULL DEFAULT 'Actif',
  permissions TEXT DEFAULT '[]',
  last_login TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS logs (id TEXT PRIMARY KEY,bank_id TEXT NOT NULL,message TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS security_logs (id TEXT PRIMARY KEY,bank_id TEXT NOT NULL,action TEXT,section TEXT,result TEXT,agent TEXT,role TEXT DEFAULT '',motif TEXT DEFAULT '',user_id TEXT DEFAULT '',created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS charge_bases (id TEXT PRIMARY KEY,bank_id TEXT NOT NULL,name TEXT NOT NULL,category TEXT,percent REAL DEFAULT 0,created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS obligations (id TEXT PRIMARY KEY,bank_id TEXT NOT NULL,name TEXT NOT NULL,amount REAL DEFAULT 0,due_day INTEGER DEFAULT 1,base_type TEXT DEFAULT 'Bénéfice général',base_item TEXT DEFAULT '',created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS reset_requests (id TEXT PRIMARY KEY,bank_id TEXT NOT NULL,user_id TEXT,message TEXT,status TEXT DEFAULT 'En attente',created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS account_types (id TEXT PRIMARY KEY,bank_id TEXT NOT NULL,name TEXT NOT NULL,is_active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS movement_types (id TEXT PRIMARY KEY,bank_id TEXT NOT NULL,name TEXT NOT NULL,is_active INTEGER NOT NULL DEFAULT 1,category TEXT DEFAULT '',is_bank_revenue INTEGER,description TEXT DEFAULT '',created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS manual_revenues (id TEXT PRIMARY KEY,bank_id TEXT NOT NULL,name TEXT NOT NULL,operations INTEGER DEFAULT 0,amount REAL DEFAULT 0,created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS ignored_revenues (id TEXT PRIMARY KEY,bank_id TEXT NOT NULL,revenue_key TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS management_settings (bank_id TEXT PRIMARY KEY,year INTEGER NOT NULL,month INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'open',updated_at TEXT NOT NULL DEFAULT (datetime('now')));

CREATE INDEX IF NOT EXISTS idx_clients_bank ON clients(bank_id);
CREATE INDEX IF NOT EXISTS idx_accounts_bank ON accounts(bank_id);
CREATE INDEX IF NOT EXISTS idx_moves_bank ON moves(bank_id);
CREATE INDEX IF NOT EXISTS idx_moves_bank_account ON moves(bank_id, account_id);
CREATE INDEX IF NOT EXISTS idx_users_bank ON users(bank_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_login_global ON users(login) WHERE login <> '';
CREATE INDEX IF NOT EXISTS idx_logs_bank ON logs(bank_id);
CREATE INDEX IF NOT EXISTS idx_security_logs_bank ON security_logs(bank_id);


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
