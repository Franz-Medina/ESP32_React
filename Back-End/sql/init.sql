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
  pending_password_encrypted TEXT,
  tb_password_encrypted TEXT,
  tb_customer_id UUID,
  tb_user_id UUID,
  role_label VARCHAR(30) NOT NULL DEFAULT 'Customer Administrator'
    CHECK (role_label IN ('Tenant Administrator', 'Customer Administrator')),
  phone_country_code VARCHAR(10),
  phone_number VARCHAR(30),
  profile_picture_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS first_name VARCHAR(100) NOT NULL DEFAULT '';

ALTER TABLE users
ADD COLUMN IF NOT EXISTS last_name VARCHAR(100) NOT NULL DEFAULT '';

ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS otp_code VARCHAR(6);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMP;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS password_reset_token_hash TEXT;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMP;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS pending_password_encrypted TEXT;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS tb_password_encrypted TEXT;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS tb_customer_id UUID;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS tb_user_id UUID;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS role_label VARCHAR(30) NOT NULL DEFAULT 'Customer Administrator';

ALTER TABLE users
ADD COLUMN IF NOT EXISTS phone_country_code VARCHAR(10);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(30);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_role_label_check'
  ) THEN
    ALTER TABLE users
    ADD CONSTRAINT users_role_label_check
    CHECK (role_label IN ('Tenant Administrator', 'Customer Administrator'));
  END IF;
END
$$;

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
  pending_password_encrypted,
  tb_password_encrypted,
  tb_customer_id,
  tb_user_id,
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
  NULL,
  '8da10ef893e00b95e42e17e9:1626ffec003f6cf04db550d923d04020:3e5859dbe84d89d212',
  NULL,
  NULL,
  'Tenant Administrator',
  '+63',
  '',
  NULL
)
ON CONFLICT (email) DO NOTHING;

UPDATE users
SET role_label = CASE
  WHEN LOWER(email) = 'tbd.avinya@gmail.com' THEN 'Tenant Administrator'
  ELSE 'Customer Administrator'
END;

SELECT setval(
  pg_get_serial_sequence('users', 'id'),
  COALESCE((SELECT MAX(id) FROM users), 1),
  true
);