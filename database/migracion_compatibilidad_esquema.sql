-- Migración controlada del esquema heredado al esquema que consume la aplicación.
-- NO elimina tablas ni registros. Ejecutar SOLO después de un respaldo verificado.
-- Requiere las siete tablas existentes en public: usuario, vehiculo, mensualidad,
-- pago, celda, registroacceso y novedad. Todo se ejecuta en una transacción.
BEGIN;
SET LOCAL client_encoding = 'UTF8';
SET LOCAL TIME ZONE 'America/Bogota';

DO $$
DECLARE
  required_tables text[] := ARRAY['usuario','vehiculo','mensualidad','pago','celda','registroacceso','novedad'];
  t text;
BEGIN
  FOREACH t IN ARRAY required_tables LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE EXCEPTION 'No se encuentra public.%. Se cancela la migración sin cambios.', t;
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='novedad' AND column_name IN ('id','id_novedad'))
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='novedad' AND column_name='placa')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='novedad' AND column_name='descripcion')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='novedad' AND column_name IN ('fecha','fecha_hora')) THEN
    RAISE EXCEPTION 'La tabla novedad no tiene las columnas esperadas (id/id_novedad, placa, descripcion, fecha/fecha_hora). Se detiene sin cambios.';
  END IF;
END $$;

-- Usuario: id -> id_usuario (las FK se actualizan automáticamente en PostgreSQL).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='usuario' AND column_name='id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='usuario' AND column_name='id_usuario') THEN
    ALTER TABLE public.usuario RENAME COLUMN id TO id_usuario;
  END IF;
END $$;

-- Vehículo: alinear el nombre de la FK del propietario.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='vehiculo' AND column_name='usuario_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='vehiculo' AND column_name='id_usuario') THEN
    ALTER TABLE public.vehiculo RENAME COLUMN usuario_id TO id_usuario;
  END IF;
END $$;

-- Mensualidad: id/estado -> id_mensualidad/estado_pago y valor requerido por el dominio.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='mensualidad' AND column_name='id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='mensualidad' AND column_name='id_mensualidad') THEN
    ALTER TABLE public.mensualidad RENAME COLUMN id TO id_mensualidad;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='mensualidad' AND column_name='estado')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='mensualidad' AND column_name='estado_pago') THEN
    ALTER TABLE public.mensualidad RENAME COLUMN estado TO estado_pago;
  END IF;
END $$;
ALTER TABLE public.mensualidad ADD COLUMN IF NOT EXISTS valor numeric(10,2) NOT NULL DEFAULT 0;

-- Pago: alinear PK, FK, estado y fecha.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='pago' AND column_name='id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='pago' AND column_name='id_pago') THEN
    ALTER TABLE public.pago RENAME COLUMN id TO id_pago;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='pago' AND column_name='mensualidad_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='pago' AND column_name='id_mensualidad') THEN
    ALTER TABLE public.pago RENAME COLUMN mensualidad_id TO id_mensualidad;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='pago' AND column_name='estado')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='pago' AND column_name='estado_pago') THEN
    ALTER TABLE public.pago RENAME COLUMN estado TO estado_pago;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='pago' AND column_name='fecha_creacion')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='pago' AND column_name='fecha_pago') THEN
    ALTER TABLE public.pago RENAME COLUMN fecha_creacion TO fecha_pago;
  END IF;
END $$;
DO $$ BEGIN
  IF (SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='pago' AND column_name='fecha_pago') = 'timestamp with time zone' THEN
    ALTER TABLE public.pago ALTER COLUMN fecha_pago TYPE timestamp(0) without time zone USING fecha_pago AT TIME ZONE 'America/Bogota';
  END IF;
END $$;
ALTER TABLE public.pago ALTER COLUMN fecha_pago SET DEFAULT LOCALTIMESTAMP(0);

-- Celda: id -> id_celda; numero_celda pasa de texto a entero tras validar contenido.
ALTER TABLE public.celda DROP CONSTRAINT IF EXISTS ck_celda_numero;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='celda' AND column_name='id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='celda' AND column_name='id_celda') THEN
    ALTER TABLE public.celda RENAME COLUMN id TO id_celda;
  END IF;
END $$;
DO $$
DECLARE tipo_col text;
BEGIN
  SELECT data_type INTO tipo_col FROM information_schema.columns
   WHERE table_schema='public' AND table_name='celda' AND column_name='numero_celda';
  IF tipo_col IN ('character varying','text','character') THEN
    IF EXISTS (SELECT 1 FROM public.celda WHERE numero_celda !~ '^[0-9]{1,4}$') THEN
      RAISE EXCEPTION 'Hay números de celda no numéricos o fuera del formato esperado. Corríjalos antes de migrar.';
    END IF;
    ALTER TABLE public.celda ALTER COLUMN numero_celda TYPE integer USING numero_celda::integer;
  END IF;
END $$;
ALTER TABLE public.celda ADD CONSTRAINT ck_celda_numero CHECK (numero_celda BETWEEN 1 AND 9999);

-- Registro de acceso: identifica el activo mediante fecha_salida nula en el legado.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='registroacceso' AND column_name='id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='registroacceso' AND column_name='id_registro') THEN
    ALTER TABLE public.registroacceso RENAME COLUMN id TO id_registro;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='registroacceso' AND column_name='celda_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='registroacceso' AND column_name='id_celda') THEN
    ALTER TABLE public.registroacceso RENAME COLUMN celda_id TO id_celda;
  END IF;
END $$;

-- Novedad: adaptar la estructura heredada (id, fecha) sin perder registros.
-- id_registro es opcional: las novedades históricas no tenían vínculo a una entrada.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='novedad' AND column_name='id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='novedad' AND column_name='id_novedad') THEN
    ALTER TABLE public.novedad RENAME COLUMN id TO id_novedad;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='novedad' AND column_name='fecha')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='novedad' AND column_name='fecha_hora') THEN
    ALTER TABLE public.novedad RENAME COLUMN fecha TO fecha_hora;
  END IF;
END $$;
ALTER TABLE public.novedad ADD COLUMN IF NOT EXISTS id_registro integer NULL;
DO $$ BEGIN
  IF (SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='novedad' AND column_name='fecha_hora') = 'timestamp with time zone' THEN
    ALTER TABLE public.novedad ALTER COLUMN fecha_hora TYPE timestamp(0) without time zone USING fecha_hora AT TIME ZONE 'America/Bogota';
  END IF;
END $$;
ALTER TABLE public.novedad ALTER COLUMN fecha_hora SET DEFAULT LOCALTIMESTAMP(0);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_novedad_registro' AND conrelid='public.novedad'::regclass) THEN
    ALTER TABLE public.novedad ADD CONSTRAINT fk_novedad_registro
      FOREIGN KEY (id_registro) REFERENCES public.registroacceso(id_registro);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_novedad_placa_fecha ON public.novedad (placa, fecha_hora);

ALTER TABLE public.registroacceso ADD COLUMN IF NOT EXISTS estado_acceso varchar(20);
UPDATE public.registroacceso SET estado_acceso = CASE WHEN fecha_salida IS NULL THEN 'En Parqueadero' ELSE 'Finalizado' END
 WHERE estado_acceso IS NULL OR estado_acceso NOT IN ('En Parqueadero','Finalizado');
ALTER TABLE public.registroacceso ALTER COLUMN estado_acceso SET DEFAULT 'En Parqueadero';
ALTER TABLE public.registroacceso ALTER COLUMN estado_acceso SET NOT NULL;
DO $$ BEGIN
  IF (SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='registroacceso' AND column_name='fecha_entrada') = 'timestamp with time zone' THEN
    ALTER TABLE public.registroacceso ALTER COLUMN fecha_entrada TYPE timestamp(0) without time zone USING fecha_entrada AT TIME ZONE 'America/Bogota';
  END IF;
  IF (SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='registroacceso' AND column_name='fecha_salida') = 'timestamp with time zone' THEN
    ALTER TABLE public.registroacceso ALTER COLUMN fecha_salida TYPE timestamp(0) without time zone USING fecha_salida AT TIME ZONE 'America/Bogota';
  END IF;
END $$;
UPDATE public.celda SET estado='Ocupada' WHERE estado <> 'Mantenimiento' AND id_celda IN (SELECT id_celda FROM public.registroacceso WHERE estado_acceso='En Parqueadero');

-- Normaliza los tipos al vocabulario que utiliza la aplicación.
-- El esquema heredado permitía 'Automóvil'; la aplicación utiliza 'Automovil'.
-- Se reemplaza temporalmente el CHECK heredado y se crea uno compatible al final.
ALTER TABLE public.celda DROP CONSTRAINT IF EXISTS celda_tipo_check;
UPDATE public.celda SET tipo = 'Automovil'
 WHERE lower(translate(tipo, 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU')) IN ('automovil','autom¾vil');
UPDATE public.vehiculo SET tipo = 'Automovil'
 WHERE lower(translate(tipo, 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU')) IN ('automovil','autom¾vil');

-- Restricciones e índices que protegen las reglas de negocio de la aplicación.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ck_celda_tipo_app' AND conrelid='public.celda'::regclass) THEN
    ALTER TABLE public.celda ADD CONSTRAINT ck_celda_tipo_app CHECK (tipo IN ('Automovil','Motocicleta','General'));
  END IF;
END $$;
ALTER TABLE public.usuario ADD COLUMN IF NOT EXISTS usuario_login varchar(40);
ALTER TABLE public.usuario ADD COLUMN IF NOT EXISTS password_hash varchar(200);
ALTER TABLE public.usuario ADD COLUMN IF NOT EXISTS estado varchar(10) NOT NULL DEFAULT 'Activo';
ALTER TABLE public.usuario ADD COLUMN IF NOT EXISTS fecha_registro timestamp(0) NOT NULL DEFAULT LOCALTIMESTAMP(0);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ck_usuario_estado' AND conrelid='public.usuario'::regclass) THEN
    ALTER TABLE public.usuario ADD CONSTRAINT ck_usuario_estado CHECK (estado IN ('Activo','Inactivo'));
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS uq_usuario_documento ON public.usuario (documento);
CREATE UNIQUE INDEX IF NOT EXISTS uq_celda_numero ON public.celda (numero_celda);
CREATE UNIQUE INDEX IF NOT EXISTS uq_usuario_login_lower ON public.usuario (lower(usuario_login)) WHERE usuario_login IS NOT NULL;
DROP INDEX IF EXISTS public.uq_acceso_placa_activa;
DROP INDEX IF EXISTS public.uq_acceso_celda_activa;
CREATE UNIQUE INDEX uq_acceso_placa_activa ON public.registroacceso (placa) WHERE estado_acceso = 'En Parqueadero';
CREATE UNIQUE INDEX uq_acceso_celda_activa ON public.registroacceso (id_celda) WHERE estado_acceso = 'En Parqueadero';

COMMIT;
