CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS institutions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('PENDING', 'APPROVED', 'SUSPENDED')),
  contact_name TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  scope TEXT NOT NULL CHECK(scope IN ('PLATFORM', 'INSTITUTION', 'COMPANION', 'CLIENT')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  scope TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS platform_accounts (
  id TEXT PRIMARY KEY,
  login_name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('ENABLED', 'DISABLED')),
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role_code TEXT NOT NULL,
  failed_login_count INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS institution_accounts (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id),
  login_name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('ENABLED', 'DISABLED')),
  permissions_json TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_reset_required INTEGER NOT NULL DEFAULT 1 CHECK(password_reset_required IN (0, 1)),
  failed_login_count INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  actor_type TEXT NOT NULL CHECK(actor_type IN ('PLATFORM', 'INSTITUTION', 'COMPANION', 'CLIENT')),
  actor_id TEXT NOT NULL,
  institution_id TEXT,
  role_code TEXT NOT NULL,
  permissions_json TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS login_attempts (
  id TEXT PRIMARY KEY,
  login_name TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  succeeded INTEGER NOT NULL CHECK(succeeded IN (0, 1)),
  failure_code TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  phone_masked TEXT NOT NULL DEFAULT '',
  display_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'DISABLED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name_encrypted TEXT NOT NULL,
  phone_encrypted TEXT NOT NULL,
  identity_encrypted TEXT NOT NULL DEFAULT '',
  gender TEXT NOT NULL DEFAULT '',
  age_group TEXT NOT NULL DEFAULT '',
  relationship TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hospitals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT '',
  district TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK(duration_minutes > 0),
  service_price INTEGER NOT NULL CHECK(service_price >= 0),
  default_companion_price INTEGER NOT NULL CHECK(default_companion_price >= 0),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0, 1)),
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS companions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED', 'DISABLED')),
  phone_masked TEXT NOT NULL DEFAULT '',
  identity_masked TEXT NOT NULL DEFAULT '',
  skills_json TEXT NOT NULL,
  hospitals_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS companion_reviews (
  id TEXT PRIMARY KEY,
  companion_id TEXT NOT NULL REFERENCES companions(id),
  status TEXT NOT NULL CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED')),
  reviewer_id TEXT,
  reason TEXT NOT NULL DEFAULT '',
  submitted_at TEXT NOT NULL,
  reviewed_at TEXT
);

CREATE TABLE IF NOT EXISTS companion_prices (
  companion_id TEXT NOT NULL REFERENCES companions(id),
  service_id TEXT NOT NULL REFERENCES services(id),
  price INTEGER NOT NULL CHECK(price >= 0),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (companion_id, service_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_no TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL CHECK(source IN ('CLIENT', 'INSTITUTION')),
  user_id TEXT REFERENCES users(id),
  institution_id TEXT REFERENCES institutions(id),
  patient_id TEXT REFERENCES patients(id),
  patient_name TEXT NOT NULL,
  patient_phone TEXT NOT NULL,
  patient_age_group TEXT NOT NULL DEFAULT '',
  patient_snapshot_json TEXT NOT NULL DEFAULT '{}',
  service_id TEXT NOT NULL REFERENCES services(id),
  service_name_snapshot TEXT NOT NULL,
  service_price_snapshot INTEGER NOT NULL CHECK(service_price_snapshot >= 0),
  companion_id TEXT REFERENCES companions(id),
  companion_price_snapshot INTEGER NOT NULL CHECK(companion_price_snapshot >= 0),
  total_amount INTEGER NOT NULL CHECK(total_amount >= 0),
  paid_amount INTEGER NOT NULL DEFAULT 0 CHECK(paid_amount >= 0),
  payment_status TEXT NOT NULL DEFAULT 'UNPAID' CHECK(payment_status IN ('UNPAID', 'PAID', 'REFUND_PENDING', 'REFUNDED')),
  hospital_name TEXT NOT NULL,
  department_name TEXT NOT NULL,
  booking_date TEXT NOT NULL,
  booking_time TEXT NOT NULL,
  dispatch_mode TEXT NOT NULL CHECK(dispatch_mode IN ('PLATFORM', 'DIRECT', 'MARKET')),
  status TEXT NOT NULL CHECK(status IN (
    'DRAFT', 'PENDING_PAYMENT', 'PENDING_ASSIGNMENT', 'PENDING_CONFIRMATION',
    'PUBLISHED', 'PENDING_SERVICE', 'IN_SERVICE', 'PENDING_REVIEW',
    'COMPLETED', 'CANCELLED'
  )),
  special_needs_json TEXT NOT NULL,
  remark TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_assignments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  companion_id TEXT NOT NULL REFERENCES companions(id),
  assignment_mode TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('OFFERED', 'ACCEPTED', 'REJECTED', 'REASSIGNED', 'CANCELLED')),
  assigned_by_type TEXT NOT NULL,
  assigned_by_id TEXT NOT NULL,
  assigned_at TEXT NOT NULL,
  responded_at TEXT
);

CREATE TABLE IF NOT EXISTS order_status_logs (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  from_status TEXT,
  to_status TEXT NOT NULL,
  operator_type TEXT NOT NULL,
  operator_id TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS companion_tasks (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),
  companion_id TEXT NOT NULL REFERENCES companions(id),
  status TEXT NOT NULL CHECK(status IN (
    'OFFERED', 'ACCEPTED', 'DEPARTING', 'ARRIVED', 'MET_PATIENT',
    'IN_SERVICE', 'PENDING_SUMMARY', 'COMPLETED', 'REJECTED', 'CANCELLED'
  )),
  assignment_mode TEXT NOT NULL CHECK(assignment_mode IN ('platform', 'selected', 'market')),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS service_execution_nodes (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL REFERENCES services(id),
  node_code TEXT NOT NULL,
  node_index INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  required INTEGER NOT NULL DEFAULT 1 CHECK(required IN (0, 1)),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0, 1)),
  UNIQUE(service_id, node_code)
);

CREATE TABLE IF NOT EXISTS service_execution_records (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  node_id TEXT NOT NULL REFERENCES service_execution_nodes(id),
  companion_id TEXT NOT NULL REFERENCES companions(id),
  status TEXT NOT NULL CHECK(status IN ('PENDING', 'ACTIVE', 'COMPLETED', 'FAILED')),
  note TEXT NOT NULL DEFAULT '',
  failure_reason TEXT NOT NULL DEFAULT '',
  evidence_json TEXT NOT NULL DEFAULT '[]',
  started_at TEXT,
  completed_at TEXT,
  failed_at TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE(order_id, node_id)
);

CREATE TABLE IF NOT EXISTS service_exceptions (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  node_id TEXT REFERENCES service_execution_nodes(id),
  companion_id TEXT NOT NULL REFERENCES companions(id),
  category TEXT NOT NULL,
  urgency TEXT NOT NULL,
  description TEXT NOT NULL,
  evidence_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL CHECK(status IN ('OPEN', 'REVIEWING', 'RESOLVED', 'REJECTED')),
  reviewer_id TEXT,
  review_note TEXT NOT NULL DEFAULT '',
  submitted_at TEXT NOT NULL,
  reviewed_at TEXT
);

CREATE TABLE IF NOT EXISTS order_expenses (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  companion_id TEXT NOT NULL REFERENCES companions(id),
  category TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK(amount >= 0),
  description TEXT NOT NULL DEFAULT '',
  receipt_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL CHECK(status IN ('SUBMITTED', 'APPROVED', 'REJECTED')),
  reviewer_id TEXT,
  review_note TEXT NOT NULL DEFAULT '',
  submitted_at TEXT NOT NULL,
  reviewed_at TEXT
);

CREATE TABLE IF NOT EXISTS uploaded_files (
  id TEXT PRIMARY KEY,
  owner_type TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK(size_bytes >= 0),
  sha256 TEXT NOT NULL,
  created_by_type TEXT NOT NULL,
  created_by_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settlements (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),
  institution_id TEXT REFERENCES institutions(id),
  companion_id TEXT NOT NULL REFERENCES companions(id),
  gross_amount INTEGER NOT NULL CHECK(gross_amount >= 0),
  companion_amount INTEGER NOT NULL CHECK(companion_amount >= 0),
  platform_amount INTEGER NOT NULL CHECK(platform_amount >= 0),
  status TEXT NOT NULL CHECK(status IN ('PENDING', 'CONFIRMED', 'PAID', 'CANCELLED')),
  created_at TEXT NOT NULL,
  confirmed_at TEXT,
  paid_at TEXT
);

CREATE TABLE IF NOT EXISTS operation_logs (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  institution_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL DEFAULT '',
  result TEXT NOT NULL,
  ip_address TEXT NOT NULL DEFAULT '',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS external_identities (
  id TEXT PRIMARY KEY,
  actor_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK(provider IN ('WECHAT_MINIPROGRAM')),
  provider_subject_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(provider, provider_subject_hash)
);

CREATE TABLE IF NOT EXISTS payment_transactions (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  provider TEXT NOT NULL DEFAULT 'WECHAT_PAY',
  provider_transaction_hash TEXT NOT NULL DEFAULT '',
  amount INTEGER NOT NULL CHECK(amount >= 0),
  status TEXT NOT NULL CHECK(status IN ('CREATED', 'PAID', 'REFUNDING', 'REFUNDED', 'FAILED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subscription_consents (
  id TEXT PRIMARY KEY,
  actor_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  template_key TEXT NOT NULL,
  status TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_institution ON orders(institution_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_market ON orders(status, dispatch_mode, booking_date);
CREATE INDEX IF NOT EXISTS idx_tasks_companion ON companion_tasks(companion_id, status);
CREATE INDEX IF NOT EXISTS idx_institution_accounts_status ON institution_accounts(status, institution_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON auth_sessions(token_hash, expires_at);
CREATE INDEX IF NOT EXISTS idx_order_assignments_order ON order_assignments(order_id, assigned_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_status_logs_order ON order_status_logs(order_id, created_at);
CREATE INDEX IF NOT EXISTS idx_execution_records_order ON service_execution_records(order_id, status);
CREATE INDEX IF NOT EXISTS idx_exceptions_order_status ON service_exceptions(order_id, status);
CREATE INDEX IF NOT EXISTS idx_expenses_order_status ON order_expenses(order_id, status);
CREATE INDEX IF NOT EXISTS idx_operation_logs_actor ON operation_logs(actor_type, actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_operation_logs_resource ON operation_logs(resource_type, resource_id, created_at DESC);
