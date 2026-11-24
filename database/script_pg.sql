-- ============================================================================
-- Parqueadero "Autos Colombia" - Iteraciones 1 y 2 - PostgreSQL 12 o superior
-- Servicio: MENSUALIDAD (no hay cobro por tiempo/estancia)
--
-- CÓMO USARLO: primero cree (una sola vez) una base de datos vacía llamada
-- autoscolombiadb, conéctese a ELLA y ejecute este archivo completo.
-- ATENCIÓN: borra y recrea las 7 tablas (se pierden los datos que haya en ellas).
-- ============================================================================
SET client_encoding = 'UTF8';
SET TIME ZONE 'America/Bogota';   -- las fechas "relativas a hoy" de los datos de prueba

DROP TABLE IF EXISTS Novedad, RegistroAcceso, Pago, Mensualidad, Celda, Vehiculo, Usuario CASCADE;

-- Usuario ---------------------------------------------------------------------
CREATE TABLE Usuario (
    id_usuario   INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre       VARCHAR(100) NOT NULL,
    documento    VARCHAR(20)  NOT NULL,
    telefono     VARCHAR(15),
    correo       VARCHAR(100),
    usuario_login VARCHAR(40) UNIQUE,
    password_hash VARCHAR(200),
    tipo_usuario VARCHAR(20)  NOT NULL DEFAULT 'Cliente',
    -- Iteración 2: los usuarios NO se borran (trazabilidad); se inactivan.
    estado         VARCHAR(10)  NOT NULL DEFAULT 'Activo',
    fecha_registro TIMESTAMP(0) NOT NULL DEFAULT LOCALTIMESTAMP(0),
    CONSTRAINT uq_usuario_documento UNIQUE (documento),
    CONSTRAINT ck_usuario_tipo CHECK (tipo_usuario IN ('Administrador','Operario','Cliente')),
    CONSTRAINT ck_usuario_estado CHECK (estado IN ('Activo','Inactivo'))
);

CREATE UNIQUE INDEX uq_usuario_login_lower ON Usuario (LOWER(usuario_login)) WHERE usuario_login IS NOT NULL;

-- Vehiculo (propietario: Usuario 1 --- 0..* Vehiculo) -------------------------
CREATE TABLE Vehiculo (
    placa      VARCHAR(10) PRIMARY KEY,
    id_usuario INT         NOT NULL,
    marca      VARCHAR(50),
    modelo     VARCHAR(50),
    color      VARCHAR(30),
    tipo       VARCHAR(20) NOT NULL,
    CONSTRAINT ck_vehiculo_tipo CHECK (tipo IN ('Automovil','Motocicleta','Camioneta')),
    CONSTRAINT fk_vehiculo_usuario FOREIGN KEY (id_usuario) REFERENCES Usuario(id_usuario)
);
CREATE INDEX idx_vehiculo_usuario ON Vehiculo (id_usuario);

-- Mensualidad: la VIGENCIA se representa con fecha_inicio / fecha_fin ----------
CREATE TABLE Mensualidad (
    id_mensualidad INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    placa          VARCHAR(10)   NOT NULL,
    fecha_inicio   DATE          NOT NULL,
    fecha_fin      DATE          NOT NULL,
    valor          NUMERIC(10,2) NOT NULL,
    estado_pago    VARCHAR(20)   NOT NULL DEFAULT 'Pendiente',
    CONSTRAINT ck_mensualidad_fechas CHECK (fecha_fin >= fecha_inicio),
    CONSTRAINT ck_mensualidad_estado CHECK (estado_pago IN ('Pendiente','Pagada','Anulada')),
    CONSTRAINT fk_mensualidad_vehiculo FOREIGN KEY (placa) REFERENCES Vehiculo(placa)
);
CREATE INDEX idx_mensualidad_placa_fin ON Mensualidad (placa, fecha_fin);

-- Pago: lo confirma el Sistema de Pago externo ---------------------------------
-- TIMESTAMP(0): sin fracciones de segundo (así la aplicación recibe 'AAAA-MM-DD HH:MM:SS').
CREATE TABLE Pago (
    id_pago            INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_mensualidad     INT           NOT NULL,
    monto              NUMERIC(10,2) NOT NULL,
    fecha_pago         TIMESTAMP(0)  NOT NULL DEFAULT LOCALTIMESTAMP(0),
    metodo_pago        VARCHAR(30)   NOT NULL,
    referencia_externa VARCHAR(40)   NOT NULL,
    estado_pago        VARCHAR(20)   NOT NULL DEFAULT 'Pendiente',
    CONSTRAINT uq_pago_referencia UNIQUE (referencia_externa),
    CONSTRAINT ck_pago_estado CHECK (estado_pago IN ('Pendiente','Aprobado','Rechazado')),
    CONSTRAINT fk_pago_mensualidad FOREIGN KEY (id_mensualidad) REFERENCES Mensualidad(id_mensualidad)
);
CREATE INDEX idx_pago_mensualidad ON Pago (id_mensualidad);

-- Celda -------------------------------------------------------------------------
CREATE TABLE Celda (
    id_celda     INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    numero_celda INT         NOT NULL,
    estado       VARCHAR(20) NOT NULL DEFAULT 'Disponible',
    tipo         VARCHAR(20) NOT NULL DEFAULT 'General',
    CONSTRAINT uq_celda_numero UNIQUE (numero_celda),
    CONSTRAINT ck_celda_numero CHECK (numero_celda BETWEEN 1 AND 9999),
    CONSTRAINT ck_celda_estado CHECK (estado IN ('Disponible','Ocupada','Mantenimiento')),
    CONSTRAINT ck_celda_tipo   CHECK (tipo   IN ('Automovil','Motocicleta','General'))
);

-- RegistroAcceso: un registro = una entrada (y su salida, cuando ocurra) -------
CREATE TABLE RegistroAcceso (
    id_registro   INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    placa         VARCHAR(10)  NOT NULL,
    id_celda      INT          NOT NULL,
    codigo_ticket VARCHAR(20)  NOT NULL,
    fecha_entrada TIMESTAMP(0) NOT NULL DEFAULT LOCALTIMESTAMP(0),
    fecha_salida  TIMESTAMP(0) NULL,
    estado_acceso VARCHAR(20)  NOT NULL DEFAULT 'En Parqueadero',
    CONSTRAINT uq_acceso_ticket UNIQUE (codigo_ticket),
    CONSTRAINT ck_acceso_estado CHECK (estado_acceso IN ('En Parqueadero','Finalizado')),
    CONSTRAINT ck_acceso_fechas CHECK (fecha_salida IS NULL OR fecha_salida >= fecha_entrada),
    CONSTRAINT fk_acceso_vehiculo FOREIGN KEY (placa)    REFERENCES Vehiculo(placa),
    CONSTRAINT fk_acceso_celda    FOREIGN KEY (id_celda) REFERENCES Celda(id_celda)
);
-- Índices únicos PARCIALES: garantizan en la BD que un vehículo no tenga dos ingresos
-- activos y que una celda no tenga dos vehículos a la vez (reemplazan las columnas
-- generadas de MySQL).
CREATE UNIQUE INDEX uq_acceso_placa_activa ON RegistroAcceso (placa)    WHERE estado_acceso = 'En Parqueadero';
CREATE UNIQUE INDEX uq_acceso_celda_activa ON RegistroAcceso (id_celda) WHERE estado_acceso = 'En Parqueadero';
CREATE INDEX idx_acceso_placa ON RegistroAcceso (placa);

-- Novedad: UNA sola entidad; se vincula al Vehiculo mediante la PLACA ----------
-- id_registro es opcional (la novedad puede ocurrir durante una estancia).
CREATE TABLE Novedad (
    id_novedad  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    placa       VARCHAR(10)  NOT NULL,
    id_registro INT          NULL,
    descripcion TEXT         NOT NULL,
    fecha_hora  TIMESTAMP(0) NOT NULL DEFAULT LOCALTIMESTAMP(0),
    CONSTRAINT fk_novedad_vehiculo FOREIGN KEY (placa)       REFERENCES Vehiculo(placa),
    CONSTRAINT fk_novedad_registro FOREIGN KEY (id_registro) REFERENCES RegistroAcceso(id_registro)
);
CREATE INDEX idx_novedad_placa ON Novedad (placa, fecha_hora);

-- Datos de prueba (fechas relativas a hoy) --------------------------------------
INSERT INTO Usuario (nombre, documento, telefono, correo, tipo_usuario) VALUES
('Carlos Pérez',   '1017123456', '3001234567', 'carlos.perez@email.com',  'Cliente'),
('Laura Gómez',    '1020987654', '3119876543', 'laura.gomez@email.com',   'Cliente'),
('Admin Sistema',  '9999999999', '3000000000', 'admin@autoscolombia.com', 'Administrador'),
('Operario Juan',  '8888888888', '3110000000', 'juan@autoscolombia.com',  'Operario');

-- Iteración 2: un cliente activo sin vehículos y un cliente inactivo (para probar la gestión)
INSERT INTO Usuario (nombre, documento, telefono, correo, tipo_usuario, estado) VALUES
('Marta Ruiz',     '1030555111', '3205551111', 'marta.ruiz@email.com',    'Cliente', 'Activo'),
('Pedro Soto',     '1030555222', '3205552222', 'pedro.soto@email.com',    'Cliente', 'Inactivo');

INSERT INTO Vehiculo (placa, id_usuario, marca, modelo, color, tipo) VALUES
('ABC123', 1, 'Mazda',  '3',   'Rojo',  'Automovil'),     -- mensualidad vigente
('XYZ987', 2, 'Yamaha', 'FZ',  'Negro', 'Motocicleta'),   -- mensualidad vencida
('MNO456', 2, 'Kia',    'Rio', 'Gris',  'Automovil'),     -- vigente, vence en 3 días
('QRS789', 1, 'Toyota', 'Hilux','Blanco','Camioneta');    -- sin mensualidad

INSERT INTO Mensualidad (placa, fecha_inicio, fecha_fin, valor, estado_pago) VALUES
('ABC123', CURRENT_DATE - 10, CURRENT_DATE + 19, 250000, 'Pagada'),
('XYZ987', CURRENT_DATE - 35, CURRENT_DATE - 5,  100000, 'Pagada'),
('MNO456', CURRENT_DATE - 26, CURRENT_DATE + 3,  250000, 'Pagada');

INSERT INTO Pago (id_mensualidad, monto, fecha_pago, metodo_pago, referencia_externa, estado_pago) VALUES
(1, 250000, LOCALTIMESTAMP(0) - INTERVAL '10 days', 'PSE',     'PAY-SEED-0001', 'Aprobado'),
(2, 100000, LOCALTIMESTAMP(0) - INTERVAL '35 days', 'Tarjeta', 'PAY-SEED-0002', 'Aprobado'),
(3, 250000, LOCALTIMESTAMP(0) - INTERVAL '26 days', 'PSE',     'PAY-SEED-0003', 'Aprobado');

INSERT INTO Celda (numero_celda, estado, tipo) VALUES
(101, 'Disponible', 'Automovil'),
(102, 'Disponible', 'Automovil'),
(103, 'Disponible', 'Automovil'),
(201, 'Disponible', 'Motocicleta'),
(202, 'Disponible', 'Motocicleta'),
(301, 'Disponible', 'General');
