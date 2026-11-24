# Entrega académica – Autos Colombia (Iteraciones 1, 2 y 3)

## 1. Contenido de la entrega
- Aplicación web y API REST desarrolladas con Node.js y Express.
- Persistencia de datos en PostgreSQL.
- Gestión de operaciones, usuarios, vehículos, celdas, mensualidades y pagos.
- Historial administrativo de pagos, filtros, resumen financiero, paginación y tarifas.
- Autenticación, autorización por roles y gestión de credenciales.
- Documentación de la Evidencia de Aprendizaje 3 en `docs/EA3/`.
- Historias de usuario, requerimientos, plan de pruebas y diagramas UML actualizados.
- Mockups actualizados según los permisos de cada rol.
- Video demostrativo de la aplicación: cargado y disponible para revisión.

## 2. Requisitos
- Node.js 18 o superior.
- PostgreSQL 12 o superior.
- Dependencias instaladas mediante `npm install`.
- Base de datos PostgreSQL configurada mediante el archivo `.env`.

## 3. Ejecución local
1. Crear la base de datos `autoscolombiadb`.
2. Configurar las variables de conexión en `.env`, tomando como referencia `.env.example`.
3. Para una base de datos nueva, ejecutar `database/script_pg.sql` sobre esa base vacía. Este script recrea las tablas y elimina los datos existentes; no ejecutarlo sobre una base con información que se quiera conservar.
4. Instalar dependencias con `npm install`.
5. Para una base existente que deba conservar sus datos, revisar la guía de migración antes de ejecutar `npm run bd:migrar`.
6. Crear el administrador inicial si todavía no existe, mediante `npm run admin:crear`.
7. Iniciar el servidor con `npm start`.
8. Abrir `http://localhost:3000`.
9. Verificar el servicio en `http://localhost:3000/api/health`.

## 4. Ejecución con Docker
Se requiere Docker Desktop con Docker Compose.
1. Abrir una terminal en la carpeta del proyecto.
2. Ejecutar `docker compose up --build`.
3. Abrir `http://localhost:3000`.
4. Comprobar `http://localhost:3000/api/health`.

Para detener los contenedores: `docker compose down`.
El comando `docker compose down -v` elimina también el volumen de datos de demostración.

## 5. Usuarios, autenticación y permisos
- El inicio de sesión se realiza desde la aplicación.
- Los permisos se determinan según el rol registrado para cada cuenta.
- Los roles contemplados son Administrador, Operario y Cliente.
- El Administrador puede asignar credenciales desde el módulo de usuarios a cuentas activas.
- Las contraseñas se almacenan mediante hash seguro con scrypt.
- Las rutas protegidas verifican la sesión y el estado actual de la cuenta.
- Cuando una cuenta se inactiva, las sesiones existentes quedan invalidadas y las solicitudes protegidas reciben HTTP 401 con el código `CUENTA_INACTIVA`.
- La asignación de credenciales no expone el hash de la contraseña en la respuesta.

## 6. Pruebas
Ejecutar `npm test` con PostgreSQL disponible y las variables de entorno configuradas.

La preparación de las pruebas utiliza la base de datos de pruebas `autoscolombiadb_test`, mediante `npm run test:preparar`. No configurar la base de datos principal como base de pruebas.

Resultado de la ejecución completa verificada:
- Autenticación: 3 pruebas aprobadas.
- Iteración 1: 33 pruebas aprobadas.
- Iteración 2: 30 pruebas aprobadas.
- Iteración 3: 3 pruebas aprobadas.
- Total: 69 pruebas aprobadas, sin fallos.

Para ejecutar suites por separado:
- `npm run test:it1`
- `npm run test:it2`
- `npm run test:it3`

## 7. Documentación de la Entrega 3
La carpeta `docs/EA3/` contiene:
- `REQUERIMIENTOS_EA3.md`: requerimientos funcionales y no funcionales.
- `HISTORIAS_USUARIO_EA3.md`: historias de usuario y criterios de aceptación.
- `PLAN_PRUEBAS_EA3.md`: casos de prueba, incluidos los escenarios de seguridad.
- `SD_integrado_iteraciones_1_2_3.mmd`: diagramas de secuencia integrados.
- `CD_componentes_actualizado.mmd`: diagrama de componentes.
- `CU_gestion_pagos.mmd`: casos de uso de gestión de pagos.
- `README.md`: índice de la documentación de EA3.

Los diagramas SVG actualizados están en `docs/diagramas/secuencia_ea3_actualizados/`.
Los mockups actualizados están en `docs/mockups/`.

## 8. Seguridad y configuración
- No publicar el archivo `.env`, contraseñas ni credenciales.
- Configurar `PAGO_WEBHOOK_SECRET` antes de utilizar el sistema de pagos fuera de una demostración.
- Para producción se recomienda HTTPS, `COOKIE_SECURE=true`, un almacén persistente de sesiones y protección adicional contra intentos repetidos de inicio de sesión.
- Las sesiones actuales se almacenan en memoria y se invalidan al reiniciar el servidor.
- Las tarifas y los datos demostrativos son configurables.

Consultar `docs/SEGURIDAD_LOGIN_ROLES.md` y `docs/GUIA_LOGIN_ROLES.md` para información adicional.
