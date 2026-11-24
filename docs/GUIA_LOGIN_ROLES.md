# Guía rápida de acceso - Autos Colombia

## Primera configuración

1. Copie .env.example como .env y configure PostgreSQL.
2. Ejecute npm install.
3. Para conservar datos existentes, ejecute npm run bd:migrar. Para una base nueva, npm run bd:crear -- --si (borra y recrea las tablas).
4. Cree las credenciales del administrador inicial con npm run admin:crear -- DOCUMENTO USUARIO CONTRASEÑA.
5. Ejecute npm start y abra http://localhost:3000.
6. Inicie sesión como administrador.
7. Para asignar credenciales a otros usuarios, abra Usuarios, consulte el detalle de un usuario activo y use el formulario de credenciales. Solo el administrador puede hacerlo.

## Permisos

- Administrador: operación, usuarios, vehículos, celdas y mensualidades; asigna credenciales a usuarios activos.
- Operario: ingresos, salidas, novedades y consultas operativas. No administra usuarios, celdas ni mensualidades.
- Cliente: consulta únicamente su ficha, vehículos y mensualidades.

El rol se obtiene de tipo_usuario en la base de datos. El inicio de sesión no permite elegir el rol. Las rutas protegidas verifican sesión y permisos en el backend.

## Seguridad de cuentas y sesiones

- Las contraseñas tienen al menos 10 caracteres y se almacenan con hash scrypt y salt aleatorio.
- La asignación desde la aplicación usa PATCH /api/usuarios/:id/credenciales y requiere rol Administrador.
- Solo se asignan credenciales a usuarios activos. El hash nunca se devuelve en la respuesta.
- Cada solicitud protegida comprueba el estado actual de la cuenta. Si se inactiva, las sesiones existentes pierden acceso y reciben HTTP 401 con código CUENTA_INACTIVA.
- Las sesiones se guardan en memoria y caducan a las 8 horas. Al reiniciar el servidor hay que iniciar sesión de nuevo.
- No publique .env ni comparta contraseñas. En producción use HTTPS y COOKIE_SECURE=true.
- Configure PAGO_WEBHOOK_SECRET para confirmar pagos.

## Docker Compose

El administrador inicial puede habilitarse con docker exec autoscolombia-app node scripts/crear-admin.js DOCUMENTO USUARIO CONTRASEÑA.
Las credenciales de los demás usuarios se asignan desde el módulo Usuarios con una sesión de administrador. No es necesario ejecutar crear-credenciales.js manualmente.
