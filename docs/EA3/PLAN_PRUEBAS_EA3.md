# Plan de pruebas resumido — Gestión de pagos

| ID | Escenario | Datos / precondición | Resultado esperado | Tipo |
|---|---|---|---|---|
| CP20 | Consultar historial autenticado | Sesión Administrador | HTTP 200, lista paginada y resumen | Integración |
| CP21 | Acceso sin sesión | Sin cookie | HTTP 401 | Seguridad |
| CP22 | Acceso por rol no autorizado | Sesión Operario | HTTP 403 | Seguridad |
| CP23 | Filtrar por estado | estado=Aprobado | Solo pagos Aprobados | Integración |
| CP24 | Filtrar por placa | placa=ABC123 | Solo pagos de ABC123 | Integración |
| CP25 | Filtrar por fechas | desde/hasta válidas | Solo transacciones del rango | Integración |
| CP26 | Fecha imposible | 2026-99-99 | HTTP 400 FILTRO_INVALIDO | Validación |
| CP27 | Rango invertido | desde mayor que hasta | HTTP 400 FILTRO_INVALIDO | Validación |
| CP28 | Paginación inválida | pagina=0 o limite=101 | HTTP 400 PAGINACION_INVALIDA | Validación |
| CP29 | Resumen de recaudo | Pagos con estados variados | Solo aprobados suman al recaudo | Integración |
| CP30 | Tarifa automóvil | 1 mes | COP $250.000 | Regla de negocio |
| CP31 | Tarifa camioneta | 1 mes | COP $250.000 | Regla de negocio |
| CP32 | Tarifa motocicleta | 1 mes | COP $100.000 | Regla de negocio |
| CP33 | Pago pendiente | Mensualidad recién generada | No habilita ingreso | Integración |
| CP34 | Pago aprobado | Referencia pendiente + webhook autorizado | Pago Aprobado y mensualidad Pagada | Integración |
| CP35 | Pago rechazado | Referencia pendiente + webhook autorizado | Pago Rechazado y mensualidad Anulada | Integración |
| CP36 | Reprocesar confirmación | Pago ya procesado | HTTP 409 PAGO_YA_PROCESADO | Integración |
| CP37 | Referencia inexistente | Referencia desconocida | HTTP 404 PAGO_NO_ENCONTRADO | Integración |

| CP38 | Asignar credenciales desde la aplicación | Administrador y usuario activo | HTTP 200, credenciales asignadas y hash no expuesto | Integración |
| CP39 | Inactivar usuario con sesión abierta | Usuario autenticado que luego es inactivado | Siguiente solicitud HTTP 401 CUENTA_INACTIVA y cookie expirada | Seguridad |

## Criterios de salida
- Todas las pruebas críticas de autorización, integridad, tarifas y confirmación deben aprobarse.
- Las pruebas de integración deben ejecutarse exclusivamente sobre una base terminada en `_test` o `_pruebas`.
- Adjuntar la salida real de `npm test`; no registrar como aprobada una prueba que no se haya ejecutado.
- Verificar `/api/health` y la navegación de la interfaz con una cuenta Administrador.

## Comando de ejecución
```bash
npm install
npm run test:it3
npm test
```

`npm run test:it3` y `npm test` requieren PostgreSQL configurado y una base de pruebas aislada. No ejecutarlos contra la base de datos operativa.

