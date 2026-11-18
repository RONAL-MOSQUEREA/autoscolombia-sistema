# Guía rápida de acceso – Autos Colombia

## Primera configuración

1. Copie `.env.example` como `.env` y configure la conexión PostgreSQL.
2. Ejecute `npm install`.
3. Si ya tiene una base de datos con datos, ejecute `npm run bd:migrar`. Para una base nueva, ejecute `npm run bd:crear -- --si` (este último comando borra y recrea las tablas).
4. Habilite el administrador existente: `npm run admin:crear -- 9999999999 admin "Una-Clave-Privada-2026!"`.
5. Inicie el servidor con `npm start` y abra `http://localhost:3000`.
6. Para habilitar un usuario creado desde el módulo Usuarios, use su ID: `npm run usuario:credenciales -- 4 operador "Otra-Clave-Privada-2026!"`.

## Permisos

- Administrador: operación, usuarios, vehículos, celdas y mensualidades.
- Operario: operación diaria (ingresos, salidas, novedades y consultas operativas).
- Cliente: su propia ficha y sus vehículos/mensualidades. No puede consultar información de otros clientes.

El perfil del usuario se determina por `tipo_usuario` en la base de datos. El formulario de inicio de sesión no permite escoger ni modificar el rol.

## Buenas prácticas

- No comparta contraseñas ni publique `.env`.
- Use contraseñas de 10 caracteres o más.
- En producción use HTTPS y `COOKIE_SECURE=true`.
- Configure `PAGO_WEBHOOK_SECRET` para que el sistema externo pueda confirmar pagos.
- Las sesiones se mantienen en memoria del servidor y caducan después de 8 horas; al reiniciar el servidor se debe iniciar sesión de nuevo.

### Si ejecuta con Docker Compose

Con el contenedor arriba, puede habilitar la cuenta de ejemplo ejecutando:

```bash
docker exec autoscolombia-app node scripts/crear-admin.js 9999999999 admin "Una-Clave-Privada-2026!"
```

Para habilitar otro usuario, consulte su `id_usuario` en PostgreSQL y ejecute el script `crear-credenciales.js` dentro del contenedor con el ID, nombre de acceso y contraseña.
