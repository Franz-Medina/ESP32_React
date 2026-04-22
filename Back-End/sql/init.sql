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
    CHECK (action_type IN ('login', 'logout', 'device_added', 'device_removed')),
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