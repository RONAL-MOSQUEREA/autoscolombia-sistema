-- ============================================================================
-- Migración a la Iteración 2 (gestión de usuarios y celdas) - PostgreSQL
-- Úsela SOLO si ya tiene la base creada con la versión anterior y NO quiere perder datos.
-- Si no le importan los datos, ejecute en su lugar database/script_pg.sql completo.
-- Se puede ejecutar varias veces sin problema.
-- ============================================================================
SET client_encoding = 'UTF8';
SET TIME ZONE 'America/Bogota';

ALTER TABLE Usuario ADD COLUMN IF NOT EXISTS estado         VARCHAR(10)  NOT NULL DEFAULT 'Activo';
ALTER TABLE Usuario ADD COLUMN IF NOT EXISTS fecha_registro TIMESTAMP(0) NOT NULL DEFAULT LOCALTIMESTAMP(0);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_usuario_estado') THEN
        ALTER TABLE Usuario ADD CONSTRAINT ck_usuario_estado CHECK (estado IN ('Activo','Inactivo'));
    END IF;
    -- nombres explícitos para que la API reconozca los duplicados
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usuario_documento_key') THEN
        ALTER TABLE Usuario RENAME CONSTRAINT usuario_documento_key TO uq_usuario_documento;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'celda_numero_celda_key') THEN
        ALTER TABLE Celda RENAME CONSTRAINT celda_numero_celda_key TO uq_celda_numero;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_celda_numero') THEN
        -- En bases antiguas numero_celda puede ser VARCHAR; en la versión nueva es INT.
        -- Se valida según el tipo real para evitar comparar VARCHAR con INTEGER.
        IF (
            SELECT data_type
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'celda'
              AND column_name = 'numero_celda'
        ) IN ('smallint', 'integer', 'bigint') THEN
            ALTER TABLE Celda
                ADD CONSTRAINT ck_celda_numero
                CHECK (numero_celda BETWEEN 1 AND 9999);
        ELSE
            ALTER TABLE Celda
                ADD CONSTRAINT ck_celda_numero
                CHECK (
                    CASE
                        WHEN numero_celda::text ~ '^[0-9]{1,4}$'
                        THEN numero_celda::text::integer BETWEEN 1 AND 9999
                        ELSE FALSE
                    END
                );
        END IF;
    END IF;
END $$;

-- Usuarios de ejemplo de la Iteración 2 (los espera `npm test`). Solo se agregan si no existen.
INSERT INTO Usuario (nombre, documento, telefono, correo, tipo_usuario, estado)
SELECT v.* FROM (VALUES
    ('Marta Ruiz', '1030555111', '3205551111', 'marta.ruiz@email.com', 'Cliente', 'Activo'),
    ('Pedro Soto', '1030555222', '3205552222', 'pedro.soto@email.com', 'Cliente', 'Inactivo')
) AS v(nombre, documento, telefono, correo, tipo_usuario, estado)
WHERE NOT EXISTS (SELECT 1 FROM Usuario u WHERE u.documento = v.documento);
