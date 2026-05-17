SET TIME ZONE 'Asia/Manila';

ALTER DATABASE authdb SET timezone TO 'Asia/Manila';

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password TEXT NOT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  otp_code VARCHAR(6),
  otp_expires_at TIMESTAMP,
  password_reset_token_hash TEXT,
  password_reset_expires_at TIMESTAMP,
  role_label VARCHAR(30) NOT NULL DEFAULT 'User'
    CHECK (role_label IN ('Administrator', 'User')),
  phone_country_code VARCHAR(10),
  phone_number VARCHAR(30),
  profile_picture_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS logs (
  id SERIAL PRIMARY KEY,
  action_type VARCHAR(30) NOT NULL
  CHECK (action_type IN (
    'login',
    'logout',
    'device_added',
    'device_updated',
    'device_removed',
    'dashboard_added',
    'dashboard_updated',
    'dashboard_removed',
    'widget_added',
    'widget_updated',
    'widget_removed'
  )),
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actor_name VARCHAR(201) NOT NULL,
  actor_email VARCHAR(255) NOT NULL DEFAULT '',
  actor_role VARCHAR(30) NOT NULL
    CHECK (actor_role IN ('Administrator', 'User')),
  details TEXT NOT NULL DEFAULT '',
  device_id VARCHAR(64),
  device_description VARCHAR(200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_action_type ON logs (action_type);
CREATE INDEX IF NOT EXISTS idx_logs_actor_role ON logs (actor_role);

CREATE TABLE IF NOT EXISTS devices (
  id SERIAL PRIMARY KEY,
  owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_name VARCHAR(255) NOT NULL,
  thingsboard_device_id VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_owner_device_name_unique
ON devices (owner_user_id, device_name);

CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_owner_thingsboard_id_unique
ON devices (owner_user_id, thingsboard_device_id);

CREATE INDEX IF NOT EXISTS idx_devices_owner_user_id
ON devices (owner_user_id);

CREATE INDEX IF NOT EXISTS idx_devices_created_at
ON devices (created_at DESC);

CREATE TABLE IF NOT EXISTS dashboards (
  id SERIAL PRIMARY KEY,
  dashboard_name VARCHAR(80) NOT NULL,
  assigned_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboards_dashboard_name_unique
ON dashboards (LOWER(dashboard_name));

CREATE INDEX IF NOT EXISTS idx_dashboards_assigned_user_id
ON dashboards (assigned_user_id);

CREATE INDEX IF NOT EXISTS idx_dashboards_device_id
ON dashboards (device_id);

CREATE INDEX IF NOT EXISTS idx_dashboards_created_at
ON dashboards (created_at DESC);

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT conname
  INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'logs'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%action_type%'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE logs DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE logs
ADD CONSTRAINT logs_action_type_check
CHECK (action_type IN (
  'login',
  'logout',
  'device_added',
  'device_updated',
  'device_removed',
  'dashboard_added',
  'dashboard_updated',
  'dashboard_removed',
  'widget_added',
  'widget_updated',
  'widget_removed'
));

CREATE TABLE IF NOT EXISTS dashboard_widgets (
  id SERIAL PRIMARY KEY,
  dashboard_id INTEGER NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  widget_key VARCHAR(80) NOT NULL,
  widget_type VARCHAR(80) NOT NULL,
  widget_name VARCHAR(100) NOT NULL,
  data_key VARCHAR(120),
  ino_file_name VARCHAR(255),
  validation_status VARCHAR(20) NOT NULL DEFAULT 'unchecked'
    CHECK (validation_status IN ('unchecked', 'success', 'failed')),
  validation_message TEXT NOT NULL DEFAULT '',
  layout_x INTEGER NOT NULL DEFAULT 0,
  layout_y INTEGER NOT NULL DEFAULT 0,
  layout_w INTEGER NOT NULL DEFAULT 6,
  layout_h INTEGER NOT NULL DEFAULT 7,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_dashboard_id
ON dashboard_widgets (dashboard_id);

CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_created_at
ON dashboard_widgets (created_at DESC);

ALTER TABLE dashboard_widgets
ADD COLUMN IF NOT EXISTS ino_file_name VARCHAR(255);

ALTER TABLE dashboard_widgets
ADD COLUMN IF NOT EXISTS validation_status VARCHAR(20) NOT NULL DEFAULT 'unchecked';

ALTER TABLE dashboard_widgets
ADD COLUMN IF NOT EXISTS validation_message TEXT NOT NULL DEFAULT '';

ALTER TABLE dashboard_widgets
ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb;

INSERT INTO users (
  id,
  first_name,
  last_name,
  email,
  password,
  is_verified,
  otp_code,
  otp_expires_at,
  password_reset_token_hash,
  password_reset_expires_at,
  role_label,
  phone_country_code,
  phone_number,
  profile_picture_url
)
VALUES (
  1,
  'Avinya',
  'Inc.',
  'tbd.avinya@gmail.com',
  '$2b$10$moCsGBiA9zx22FZ50EQQMurcbi6edaECjfo6rjdIZ4Sm.ICnxDZuW',
  TRUE,
  NULL,
  NULL,
  NULL,
  NULL,
  'Administrator',
  '+63',
  '',
  NULL
)
ON CONFLICT (email) DO NOTHING;

SELECT setval(
  pg_get_serial_sequence('users', 'id'),
  COALESCE((SELECT MAX(id) FROM users), 1),
  true
);