-- Migración segura de autenticación y roles. No elimina datos existentes.
ALTER TABLE Usuario ADD COLUMN IF NOT EXISTS usuario_login VARCHAR(40);
ALTER TABLE Usuario ADD COLUMN IF NOT EXISTS password_hash VARCHAR(200);
CREATE UNIQUE INDEX IF NOT EXISTS uq_usuario_login_lower ON Usuario (LOWER(usuario_login)) WHERE usuario_login IS NOT NULL;
