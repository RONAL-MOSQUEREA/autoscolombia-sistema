# Seguridad: autenticación y autorización

## Inicio de sesión
- Identificador: `usuario_login`.
- Contraseña: hash `scrypt` con salt aleatorio por usuario.
- Sesión: token aleatorio en cookie `HttpOnly`, `SameSite=Lax`, con expiración de 8 horas.
- Cierre de sesión: invalida el token del servidor y elimina la cookie.
- No se incluyen credenciales predeterminadas en el repositorio.

## Roles y autorizaciones
- **Administrador:** administración de usuarios, vehículos, celdas, mensualidades y operaciones.
- **Operario:** consulta del tablero y estado de vehículos; registro de ingresos, salidas y novedades. No puede administrar usuarios, celdas ni mensualidades.
- **Cliente:** consulta únicamente su propia ficha y vehículos mediante `/api/auth/mi-cuenta`.

Todas las rutas internas exigen sesión y cada grupo de rutas aplica autorización en backend. El webhook de pagos es una integración de servidor a servidor y exige `PAGO_WEBHOOK_SECRET`.

## Puesta en marcha
1. Ejecutar `npm run bd:migrar` para conservar los datos existentes.
2. Crear credenciales del administrador con `npm run admin:crear -- <documento> <usuario> <contraseña>`.
3. Crear credenciales de operarios/clientes con `npm run usuario:credenciales -- <id_usuario> <usuario> <contraseña>`.
4. Ejecutar `npm start` y entrar por la pantalla de inicio de sesión.

No se debe publicar el archivo `.env` ni reutilizar contraseñas de demostración. Para producción se recomienda HTTPS y `COOKIE_SECURE=true`.
