# Evidencia de Aprendizaje 3 — Requerimientos de gestión de pagos

## Alcance
La Iteración 3 amplía el flujo de mensualidades y pagos ya existente en las Iteraciones 1 y 2. El servicio del parqueadero es por mensualidad; no se factura por horas o minutos de permanencia.

## Requerimientos funcionales
| Código | Requerimiento |
|---|---|
| RF20 | El Administrador podrá consultar el historial de pagos registrados. |
| RF21 | El Administrador podrá filtrar pagos por estado (Pendiente, Aprobado o Rechazado). |
| RF22 | El Administrador podrá buscar el historial por placa del vehículo. |
| RF23 | El Administrador podrá delimitar la consulta por fecha inicial y fecha final. |
| RF24 | El sistema mostrará por cada transacción la referencia, fecha, propietario, placa, periodo de mensualidad, método, valor y estado. |
| RF25 | El sistema presentará indicadores agregados de pagos aprobados, pendientes, rechazados y total recaudado. El total recaudado solo suma pagos aprobados. |
| RF26 | El sistema permitirá navegar el historial paginado, con un máximo de 100 registros por página. |
| RF27 | El sistema calculará automáticamente el valor de la mensualidad según el tipo de vehículo y el número de meses: automóvil/camioneta $250.000 por mes y motocicleta $100.000 por mes. |
| RF28 | El sistema conservará la confirmación de pagos mediante el endpoint de integración, validando el secreto del webhook cuando esté configurado. |
| RF29 | El sistema actualizará el estado de la mensualidad a Pagada únicamente cuando el pago sea aprobado; si se rechaza, la mensualidad quedará Anulada. |
| RF30 | El sistema impedirá procesar nuevamente una transacción que ya no esté Pendiente. |
| RF31 | El sistema restringirá la consulta administrativa del historial de pagos al rol Administrador. |

| RF32 | El sistema permitirá iniciar sesión y determinará los permisos según el rol registrado en la cuenta. |
| RF33 | El Administrador podrá asignar desde la aplicación credenciales a usuarios activos. |
| RF34 | El sistema invalidará las sesiones existentes cuando una cuenta sea inactivada. |

## Requerimientos no funcionales
| Código | Requerimiento |
|---|---|
| RNF20 | Seguridad: el historial exige sesión autenticada y autorización Administrador en el backend. |
| RNF21 | Integridad: la actualización del pago y de su mensualidad se realizará en una única transacción PostgreSQL. |
| RNF22 | Trazabilidad: cada pago conserva identificador, referencia externa única, fecha, método, monto y estado. |
| RNF23 | Validación: filtros de estado, placa, fechas y paginación serán validados antes de consultar la base. |
| RNF24 | Rendimiento: las consultas serán paginadas y el tamaño máximo de página será 100. |
| RNF25 | Usabilidad: la interfaz mostrará mensajes claros, estados diferenciados e indicadores de resumen. |
| RNF26 | Compatibilidad: la solución continuará usando Node.js, Express y PostgreSQL, manteniendo la arquitectura en capas existente. |
| RNF27 | Mantenibilidad: reglas de negocio en servicios, SQL en repositorios y traducción HTTP en controladores. |
| RNF28 | Disponibilidad de datos: el sistema no alterará ni eliminará transacciones históricas desde la pantalla de consulta. |
| RNF29 | Moneda: los valores se expresarán en pesos colombianos (COP), sin cobros por tiempo de estancia. |

| RNF30 | Autenticación: las rutas protegidas exigirán una sesión válida y verificarán el estado actual de la cuenta. |
| RNF31 | Protección de credenciales: las contraseñas se almacenarán con hash seguro y nunca se devolverá el hash. |
| RNF32 | Revocación: una cuenta inactiva recibirá HTTP 401 con código CUENTA_INACTIVA en solicitudes protegidas. |

## Reglas de negocio
1. La mensualidad cubre 30 días por mes solicitado, conforme a la regla vigente del sistema.
2. Automóvil y camioneta: COP $250.000 por mes. Motocicleta: COP $100.000 por mes.
3. Una mensualidad solo habilita el ingreso cuando su estado es Pagada y la fecha actual está dentro del periodo.
4. Un pago pendiente no activa la mensualidad.
5. Un pago pendiente por placa bloquea la creación de otro hasta confirmación o expiración automática (24 horas).
6. La confirmación Aprobado cambia el pago a Aprobado y la mensualidad a Pagada. Rechazado cambia el pago a Rechazado y la mensualidad a Anulada.
7. La pantalla de gestión es de consulta administrativa. No se permite editar manualmente pagos aprobados/rechazados.
8. El Administrador consulta el historial; el Operario mantiene las tareas operativas; el Cliente no accede al módulo administrativo.
