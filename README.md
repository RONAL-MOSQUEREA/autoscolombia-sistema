# Parqueadero "Autos Colombia" - Sistema de Información (Iteraciones 1 y 2)

El servicio del parqueadero es por **mensualidad** (no se cobra por tiempo de estancia).

| Iteración | Alcance | Requisitos |
|---|---|---|
| 1 | Entrada y salida de vehículos, mensualidades y pagos, novedades, dashboard | RF01 - RF06 |
| 2 | **Gestión de usuarios y vehículos** y **gestión de celdas** | RF07 - RF19 |

## Documentación (Evidencia de Aprendizaje 2)
Todo está en la carpeta [`docs/`](docs/):

| Archivo | Contenido |
|---|---|
| [`DOCUMENTACION_EA2.pdf`](docs/DOCUMENTACION_EA2.pdf) | Documento completo: requisitos funcionales y no funcionales, casos de uso, historias de usuario, mockups, diagramas de secuencia (iteraciones 1 y 2), diagrama de componentes y plan de pruebas |
| [`DOCUMENTACION_EA2_editable.docx`](docs/DOCUMENTACION_EA2_editable.docx) | El mismo documento en Word, para completar la portada |
| [`diagramas/`](docs/diagramas/) | Cada diagrama UML por separado (SVG y PNG) |
| [`mockups/`](docs/mockups/) | Las 9 pantallas diseñadas (SVG y PNG) |
| [`GUION_VIDEO.md`](docs/GUION_VIDEO.md) | Guion minuto a minuto del video |

## Arquitectura en capas
| Capa | Carpeta | Responsabilidad |
|---|---|---|
| Presentation | `public/`, `routes/`, `controllers/` | Vistas, rutas REST y traducción HTTP ⇄ negocio |
| BusinessLogic | `services/` | Iteración 1: `ControlOperaciones` (`IControlOperaciones`), `ValidadorMensualidad`, `AsignadorCelda`. Iteración 2: `GestionUsuarios` (`IGestionUsuarios`) y `GestionCeldas` (`IGestionCeldas`). **Aquí están las reglas de negocio** |
| DataAccess (persistencia) | `repositories/`, `config/db.js` | Único lugar con SQL; conexión y transacciones |
| Model | `models/` | Entidades: Usuario, Vehiculo, Mensualidad, Pago, Celda, RegistroAcceso, Novedad |

## Instalación
Requisitos: Node.js 18+ y PostgreSQL 12 o superior.

**Comandos para la base de datos (no necesitan pgAdmin):** usan los datos de conexión de su archivo `.env`.

| Comando | Qué hace |
|---|---|
| `npm run bd:verificar` | Comprueba que la base esté lista para la Iteración 2 y dice qué falta, si algo falta |
| `npm run bd:migrar` | Actualiza una base de la versión anterior **conservando sus datos** (se puede repetir) y verifica |
| `npm run bd:crear -- --si` | **Borra** las 7 tablas y las recrea con los datos de ejemplo (sin `--si` no hace nada) |

**¿Ya tiene la base de la versión anterior y no quiere perder datos?** Ejecute `npm run bd:migrar` (equivale a ejecutar
`database/migracion_iteracion2.sql`) y salte al paso 3.

1. Crear una base de datos vacía (una sola vez). En pgAdmin: clic derecho en *Databases → Create → Database*,
   nombre `autoscolombiadb`. O ejecutar en una consulta sobre la base `postgres`:
   `CREATE DATABASE autoscolombiadb ENCODING 'UTF8' TEMPLATE template0;`
2. Conectarse a `autoscolombiadb` y ejecutar completo `database/script_pg.sql`
   (pgAdmin: *Query Tool* → abrir archivo → ▶ ejecutar; consola: `psql -U postgres -d autoscolombiadb -f database/script_pg.sql`).
   Recrea las 7 tablas con datos de prueba y se puede repetir las veces que haga falta.
3. Copiar `.env.example` a `.env` y poner en `DB_PASSWORD` la clave que eligió al instalar PostgreSQL.
4. `npm install`
5. `npm start` y abrir http://localhost:3000 (`npm run dev` reinicia solo al guardar cambios).
6. Verificar: http://localhost:3000/api/health debe responder `{"estado":"ok",...}`.
7. `npm test` ejecuta las 62 pruebas de integración (33 de la Iteración 1 + 29 de la Iteración 2); `npm run test:it1` y `npm run test:it2` las ejecutan por separado (requieren la BD creada).
   **Cuidado:** las pruebas borran `RegistroAcceso`, `Novedad` y los pagos de prueba de la BD configurada en `.env`.

### Secreto del Sistema de Pago (producción)
`POST /api/pagos/confirmacion` es el único endpoint que aprueba dinero. Defina `PAGO_WEBHOOK_SECRET` en `.env` y el
Sistema de Pago deberá enviarlo en el encabezado `x-webhook-secret`; sin él responde `401 NO_AUTORIZADO`.
Si se deja vacío (modo demostración) los botones «Sistema de Pago» de la pantalla funcionan, pero cualquiera podría
confirmar pagos; el servidor lo avisa al arrancar. Con el secreto activo esos botones dejan de funcionar (es lo esperado:
el navegador no debe conocer el secreto).

## API
| Método y ruta | Requisito | Descripción |
|---|---|---|
| `GET /api/vehiculos/:placa/estado` | RF02 | Estado de la mensualidad antes del ingreso |
| `POST /api/ingresos` `{placa, novedad?}` | RF01 | Valida, asigna celda automática y genera ticket |
| `POST /api/salidas` `{placa?, codigo_ticket?}` | RF03 | Cierra ingreso, libera celda, tiempo de permanencia |
| `GET /api/dashboard` | RF04 | Resumen operativo |
| `GET /api/usuarios?buscar=&tipo=&estado=&pagina=&limite=` | RF08 | Lista/busca usuarios (nombre, documento, correo o placa) |
| `POST /api/usuarios` `{nombre, documento, telefono?, correo?, tipo_usuario?}` | RF07 | Registra un usuario (nace Activo) |
| `GET /api/usuarios/:id` | RF09 | Detalle con vehículos y estado de cada mensualidad |
| `PUT /api/usuarios/:id` | RF10 | Actualiza los campos enviados |
| `PATCH /api/usuarios/:id/estado` `{estado}` | RF11 | Inactiva / reactiva (baja lógica) |
| `POST /api/usuarios/:id/vehiculos` `{placa, tipo, marca?, modelo?, color?}` | RF12 | Registra un vehículo al usuario |
| `PUT /api/vehiculos/:placa` | RF13 | Actualiza datos, tipo o propietario |
| `GET /api/celdas?estado=&tipo=` | RF14 | Lista celdas con filtros |
| `GET /api/celdas/:id` | RF15 | Detalle: ocupante actual y número de usos |
| `POST /api/celdas` `{numero_celda, tipo?}` | RF16 | Registra una celda (nace Disponible) |
| `PUT /api/celdas/:id` | RF17 | Edita número y/o tipo (no si está ocupada) |
| `PATCH /api/celdas/:id/estado` `{estado}` | RF18 | Disponible / Mantenimiento |
| `DELETE /api/celdas/:id` | RF19 | Elimina (solo si nunca se usó y no está ocupada) |
| `GET /api/health` | — | Estado del servicio y de la conexión a la BD (200 / 503) |
| `POST /api/novedades`, `GET /api/novedades/:placa` | RF05 | Novedades por placa |
| `POST /api/mensualidades` `{placa, meses, metodo_pago}` | RF06 | Crea mensualidad y pago pendiente (un solo pendiente por placa; expira a las 24 h, ver `config/tarifas.js`) |
| `POST /api/pagos/confirmacion` `{referencia_externa, estado}` | RF06 | Callback del Sistema de Pago |

Errores de negocio: `{ "error": "...", "codigo": "..." }` con códigos `MENSUALIDAD_VENCIDA` (403), `SIN_MENSUALIDAD` (403),
`VEHICULO_NO_REGISTRADO` (404), `INGRESO_DUPLICADO` (409), `SIN_CELDA_COMPATIBLE` (409), `SIN_INGRESO_ACTIVO` (404),
`TICKET_NO_COINCIDE` (409), `PLACA_INVALIDA` (400), `PAGO_PENDIENTE` (409), `DESCRIPCION_MUY_LARGA` (400, máx. 500 caracteres),
`ID_INVALIDO` (400), `MESES_INVALIDOS` (400), `NO_AUTORIZADO` (401), `JSON_INVALIDO` (400), `CUERPO_MUY_GRANDE` (413),
`RUTA_NO_ENCONTRADA` (404), `CONFLICTO_CONCURRENCIA` (503) y `BD_NO_DISPONIBLE` (503).

Iteración 2: `DATOS_INVALIDOS` (400, con el detalle por campo en `campos`), `DATOS_INCOMPLETOS` (400), `FILTRO_INVALIDO` (400),
`PAGINACION_INVALIDA` (400), `ESTADO_INVALIDO` (400), `USUARIO_NO_ENCONTRADO` (404), `CELDA_NO_ENCONTRADA` (404),
`DOCUMENTO_DUPLICADO` (409), `PLACA_DUPLICADA` (409), `CELDA_DUPLICADA` (409), `USUARIO_INACTIVO` (403 al ingresar, 409 al registrar vehículo),
`USUARIO_CON_VEHICULO_DENTRO` (409), `USUARIO_CON_VEHICULOS` (409), `TIPO_USUARIO_SIN_VEHICULOS` (409), `VEHICULO_DENTRO` (409),
`PROPIETARIO_NO_VALIDO` (409), `CELDA_OCUPADA` (409) y `CELDA_CON_HISTORIAL` (409).
Todas las respuestas de error son JSON con ese formato: nunca HTML ni trazas internas.

Las placas aceptan espacios y guiones: `abc-123` equivale a `ABC123`.

## Datos de prueba
`ABC123` mensualidad vigente · `XYZ987` vencida · `MNO456` vence en 3 días · `QRS789` sin mensualidad.
Usuarios de ejemplo: 2 clientes con vehículos, 1 administrador, 1 operario, 1 cliente activo sin vehículos (Marta Ruiz) y 1 cliente inactivo (Pedro Soto).
Celdas de ejemplo: 101-103 (Automóvil), 201-202 (Motocicleta) y 301 (General).

Los valores de mensualidad (`config/tarifas.js`) son supuestos: ajústelos a los reales.

## Correcciones de la versión 1.2.0
| Defecto | Corrección |
|---|---|
| **Deadlock**: ~40 % de los ingresos simultáneos de vehículos *distintos* fallaba con 500 | Se quitó el `FOR UPDATE` que tomaba bloqueos de hueco (`registrarIngreso`) y `enTransaccion` reintenta ante deadlock |
| El callback de pagos no tenía autenticación | Encabezado `x-webhook-secret` (`PAGO_WEBHOOK_SECRET`) |
| Se podían apilar mensualidades sin pagar hacia el futuro | Un solo pago pendiente por placa; expira solo; la renovación encadena desde la última *pagada* |
| JSON inválido y rutas inexistentes devolvían HTML con traza interna | Middleware central de errores (`routes/errores.js`) |
| BD apagada = `500` genérico en todo | `503 BD_NO_DISPONIBLE` con mensaje claro, `/api/health`, aviso al arrancar |
| `PATCH /celdas/abc/estado` y novedades > 64 KB devolvían 500 | Validación 400 + límite de 500 caracteres + tope de 20 KB por petición |
| `rollback` fallido ocultaba el error original | `enTransaccion` conserva el error y descarta la conexión dañada |
| Tildes corruptas al importar el SQL por consola; no se podía cambiar el puerto de la BD | `SET client_encoding = 'UTF8'` y `DB_PORT` |
| `npm run dev` fallaba (nodemon no estaba instalado) | `nodemon` como devDependency; se añadió `.gitignore` y `engines` |
| Frontend: pantalla en blanco si el servidor fallaba, doble clic enviaba dos veces, respuestas viejas pisaban a las nuevas, `ABC-123` rechazada | Manejo de errores de red, botones bloqueados en curso, control de secuencia, normalización de placa y refresco automático cada 30 s |

## Versión 1.3.0: migración de MySQL a PostgreSQL
- Driver `pg` en lugar de `mysql2`; parámetros `$1, $2...` en lugar de `?`; `RETURNING` en lugar de `insertId`.
- Las columnas generadas (`placa_activa`, `celda_activa`) pasan a **índices únicos parciales**, que dan la misma garantía:
  un vehículo no puede tener dos ingresos activos y una celda no puede tener dos vehículos.
- Las fechas se calculan con la zona horaria `DB_TIMEZONE` (por defecto `America/Bogota`), no con la del servidor.
- Se maneja el evento `error` del pool: sin él, reiniciar PostgreSQL tumbaba el proceso de Node.
- Pruebas: 33/33, estrés de concurrencia 80/80 sin deadlocks, y caída/recuperación de la BD verificadas.

## Versión 2.0.0: Iteración 2 (gestión de usuarios y de celdas)
- Nuevos servicios `GestionUsuarios` y `GestionCeldas` con sus interfaces; la consulta y el cambio de estado de celdas pasaron a `GestionCeldas`.
- Regla que une las dos iteraciones: **los vehículos de un usuario inactivo no pueden ingresar** (`USUARIO_INACTIVO`), y no se puede
  inactivar a un usuario con un vehículo dentro. Ambas reglas son seguras ante peticiones simultáneas.
- Los usuarios y las celdas con historial **nunca se borran físicamente** (trazabilidad); se inactivan o se ponen en mantenimiento.
- Base de datos: `Usuario.estado`, `Usuario.fecha_registro` y nombres explícitos para las restricciones únicas (script de migración incluido).
- Interfaz: pestañas **Operación**, **Usuarios** y **Celdas**.
- Pruebas: 62 de API (cada suite limpia lo que crea) y rendimiento medido con 10.006 usuarios (peor p95: 29 ms).
- La API implementa autenticación mediante sesión y autorización por roles (Administrador, Operario y Cliente); consulte `docs/SEGURIDAD_LOGIN_ROLES.md`.

## Autenticación y permisos por roles (Iteración 2)

El sistema ahora exige inicio de sesión antes de acceder a las funciones privadas. Las contraseñas se almacenan con `scrypt` y salt aleatorio; la sesión usa cookie `HttpOnly`, `SameSite=Lax` y expiración de 8 horas. Para despliegues HTTPS configure `COOKIE_SECURE=true`.

### Aplicar migración sin perder datos

```bash
npm run bd:migrar
```

Este comando aplica tanto la migración de Iteración 2 como `database/migracion_login_roles.sql`. Si se crea una base nueva desde cero, `database/script_pg.sql` ya incluye las columnas de autenticación.

### Habilitar la primera cuenta de administrador

La migración no asigna contraseñas por defecto ni deja credenciales conocidas. Use un usuario administrador que ya exista en la tabla `Usuario` (en la base de ejemplo, documento `9999999999`) y ejecute:

```bash
npm run admin:crear -- 9999999999 admin "Cambie-Esta-Clave-2026!"
```

La contraseña debe tener al menos 10 caracteres. Cambie el ejemplo por una contraseña privada. Para crear acceso a otro usuario activo:

```bash
npm run usuario:credenciales -- 4 operador "Otra-Clave-Segura-2026!"
```

El usuario debe existir previamente. Su rol se toma del campo `tipo_usuario` y no se elige desde el formulario de login.

### Matriz de permisos

| Función | Administrador | Operario | Cliente |
|---|---:|---:|---:|
| Ver panel operativo | Sí | Sí | No |
| Registrar ingresos, salidas y novedades | Sí | Sí | No |
| Consultar estado de vehículos | Sí | Sí | No |
| Administrar usuarios y vehículos | Sí | No | No |
| Administrar celdas | Sí | No | No |
| Crear mensualidades | Sí | No | No |
| Consultar su propia cuenta y vehículos | No | No | Sí |

Los permisos se verifican en el servidor (API), no solamente ocultando botones en el navegador. Las sesiones guardadas en memoria se invalidan al reiniciar el proceso; los usuarios deberán iniciar sesión nuevamente. Configure `PAGO_WEBHOOK_SECRET` para habilitar confirmaciones de pago externas.


## Seguridad de datos y pruebas automatizadas

**No ejecutes las pruebas contra la base de datos real.** Las suites reinician los datos de ejemplo. Ahora se conectan exclusivamente a `DB_TEST_NAME`, cuyo valor recomendado es `autoscolombiadb_test`.

1. Copia `.env.example` a `.env` y configura las credenciales locales. No subas `.env` a GitHub.
2. Ejecuta `npm run test:preparar` para crear/reconstruir la base exclusiva de pruebas (terminada en `_test`).
3. Ejecuta `npm test` para correr las pruebas. `npm run test:it1` y `npm run test:it2` también preparan la base aislada antes de ejecutar su suite.
4. Si la base de pruebas ya existe, `test:preparar` la reconstruye con el esquema y los datos de ejemplo. No uses ese comando con una base que contenga información real.

### Migración de una base heredada existente

Antes de migrar `DB_NAME`, crea un respaldo verificable con `pg_dump`. Luego ejecuta `npm run bd:migrar -- --respaldo-confirmado` y finalmente `npm run bd:verificar`. La migración de compatibilidad no ejecuta `script_pg.sql` ni elimina tablas. Se detendrá si la tabla `novedad` no tiene las columnas esperadas; en ese caso inspecciona su estructura antes de continuar.

`npm run bd:crear -- --si` es destructivo: elimina y recrea tablas. No lo uses para actualizar una base que tenga datos.
