# Seguridad: autenticación y autorización

## Inicio de sesión
- Identificador: `usuario_login`.
- Contraseña: hash `scrypt` con salt aleatorio por usuario.
- Sesión: token aleatorio en cookie `HttpOnly`, `SameSite=Lax`, con expiración de 8 horas.
- Cierre de sesión: invalida el token del servidor y elimina la cookie.
- No se incluyen credenciales predeterminadas en el repositorio.

## Roles y autorizaciones
- **Administrador:** administración de usuarios, vehículos, celdas, mensualidades y operaciones. Puede asignar credenciales a usuarios activos desde el detalle del usuario.
- **Operario:** consulta del tablero y estado de vehículos; registro de ingresos, salidas y novedades. No puede administrar usuarios, celdas ni mensualidades.
- **Cliente:** consulta únicamente su propia ficha y vehículos mediante `/api/auth/mi-cuenta`.

La interfaz no permite elegir el rol durante el inicio de sesión. El rol se obtiene de la cuenta registrada en la base de datos y las autorizaciones se verifican en el backend.

## Protección e invalidación de sesiones
- Las rutas internas exigen una sesión válida y aplican autorización según el rol.
- En cada solicitud protegida se consulta el estado actual de la cuenta en PostgreSQL.
- Si una cuenta fue inactivada, la sesión existente deja de autorizar solicitudes: se elimina el token, se expira la cookie y se responde HTTP 401 con el código `CUENTA_INACTIVA`.
- Los cambios de rol registrados en la base de datos se reflejan en las siguientes solicitudes protegidas.
- El webhook de pagos es una integración de servidor a servidor y exige `PAGO_WEBHOOK_SECRET`.

## Asignación de credenciales desde la aplicación
1. El administrador inicia sesión y abre el módulo **Usuarios**.
2. Consulta el detalle de un usuario activo.
3. En el formulario de credenciales registra un nombre de usuario y una contraseña.
4. La aplicación envía `PATCH /api/usuarios/:id/credenciales`.
5. El backend exige el rol Administrador, valida el identificador y la contraseña, comprueba que el usuario esté activo y almacena el hash de la contraseña.
6. La respuesta no expone el hash. Los nombres de usuario duplicados o los datos inválidos se rechazan.
7. Las cuentas inactivas no pueden recibir credenciales hasta ser reactivadas.

La asignación de credenciales de operarios y clientes se realiza desde esta funcionalidad de la aplicación; no se requiere ejecutar manualmente el script de consola para cada usuario.

## Puesta en marcha
1. Ejecutar `npm run bd:migrar` para conservar los datos existentes.
2. Crear las credenciales del administrador inicial con `npm run admin:crear -- <documento> <usuario> <contraseña>`.
3. Ejecutar `npm start` y entrar por la pantalla de inicio de sesión.
4. El administrador asigna las credenciales de los demás usuarios desde el módulo **Usuarios**.

No se debe publicar el archivo `.env` ni reutilizar contraseñas de demostración. Para producción se recomienda HTTPS y `COOKIE_SECURE=true`.
