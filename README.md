# Autos Colombia – Sistema de información
## Entregas académicas: Iteraciones 1, 2 y 3

Sistema web para administrar un parqueadero por mensualidad: usuarios, vehículos, celdas, operaciones y pagos. Desarrollado con Node.js, Express y PostgreSQL

## Entrega 3

Esta versión integra la gestión de pagos y las correcciones de autenticación, autorización y seguridad solicitadas para la entrega:
- Roles Administrador, Operario y Cliente, determinados desde la cuenta.
- Asignación de credenciales desde la aplicación para usuarios activos.
- Validación de sesión y estado actual de la cuenta en las rutas protegidas.
- Invalidación de sesiones existentes al inactivar una cuenta.
- Historias, requerimientos, plan de pruebas, diagramas y mockups actualizados.
- Video demostrativo indicado como cargado y disponible para revisión.

## Requisitos
- Node.js y npm.
- PostgreSQL.
- Base de datos configurada mediante las variables de `.env` (usar `.env.example` como referencia).

## Instalación y ejecución
1. Instalar dependencias: `npm install`.
2. Configurar la conexión a PostgreSQL en `.env`.
2. Iniciar el servidor: `npm start`.
4. Abrir `http://localhost:3000` (el puerto puede configurarse mediante el entorno).

Para una base de datos nueva y vacía, consulte el procedimiento de creación antes de ejecutar `npm run bd:crear`. Ese comando puede crear/recrear tablas y no debe utilizarse sobre una base cuyos datos se quieran conservar. Para una base existente, revise primero la guía de seguridad y migración.

Para crear el administrador inicial, si aún no existe, use `npm run admin:crear` siguiendo las instrucciones del proyecto.

## Pruebas

Ejecutar la suite completa con:

```bash
npm test
```

La última ejecución verificada de la suite completa obtuvo **69 pruebas aprobadas y ningún fallo**:
- Autenticación: 3.
- Iteración 1: 33.
- Iteración 2: 30.
- Iteración 3: 3.

Las pruebas utilizan la base de datos de pruebas `autoscolombiadb_test`, preparada mediante `npm run test:preparar`. Verifique la configuración antes de ejecutar pruebas y no las dirija a una base con datos reales.

Suites individuales:

```bash
npm run test:it1
npm run test:it2
npm run test:it3
```

## Autenticación y seguridad
- Las contraseñas se almacenan mediante hash scrypt.
- Las rutas protegidas requieren una sesión válida y consultan el estado y rol actuales de la cuenta.
- Una cuenta inactiva no puede iniciar sesión ni conservar una sesión previamente abierta.
- El Administrador asigna credenciales desde el módulo de usuarios a cuentas activas.
- Las respuestas de la aplicación no exponen hashes de contraseñas.

Guías:
- `docs/SEGURIDAD_LOGIN_ROLES.md`
- `docs/GUIA_LOGIN_ROLES.md`

## Documentación de la Entrega 3
La carpeta `docs/EA3/` contiene el índice, requerimientos, historias de usuario, plan de pruebas, casos de uso y diagramas fuente.

Los diagramas de secuencia y componentes en SVG están en `docs/diagramas/secuencia_ea3_actualizados/`. Los mockups están en `docs/mockups/`.

## Configuración
No publiques `.env`, contraseñas ni archivos con credenciales. Configura `PAGO_WEBHOOK_SECRET` antes de utilizar pagos fuera de una demostración. Para producción, utiliza HTTPS y configura adecuadamente las cookies y el almacenamiento de sesiones.

## Repositorio
Código fuente y documentación de Autos Colombia. Rama principal: `main`.
