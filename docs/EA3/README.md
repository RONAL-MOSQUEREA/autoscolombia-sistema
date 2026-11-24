# Evidencia de Aprendizaje 3 â€” IteraciÃ³n 3

Esta carpeta contiene los artefactos nuevos de gestiÃ³n de pagos:
- `REQUERIMIENTOS_EA3.md`: requerimientos funcionales/no funcionales y reglas.
- `HISTORIAS_USUARIO_EA3.md`: historias y criterios de aceptaciÃ³n.
- `MOCKUP_gestion_pagos.svg`: propuesta visual de la pantalla.
- `CU_gestion_pagos.mmd`: fuente editable del diagrama de casos de uso.
- `SD_integrado_iteraciones_1_2_3.mmd`: secuencia de extremo a extremo de las tres iteraciones.
- `CD_componentes_actualizado.mmd`: fuente Mermaid del diagrama de componentes.
- `../diagramas/secuencia_ea3_actualizados/CD_componentes_actualizado (1).svg`: diagrama de componentes renderizado.
- `PLAN_PRUEBAS_EA3.md`: plan de pruebas, incluidos los escenarios CP38 y CP39 de credenciales e invalidación de sesiones.
- `../SEGURIDAD_LOGIN_ROLES.md`: detalle de autenticación, permisos y protección de sesiones.
- `../GUIA_LOGIN_ROLES.md`: instrucciones de acceso y administración de credenciales.

Los diagramas se entregan en fuente Mermaid editable y deben abrirse/renderizarse en la herramienta UML solicitada por la instituciÃ³n (StarUML) para generar la evidencia nativa/captura si el docente exige especÃ­ficamente ese formato. No se declara que estos archivos sean un proyecto nativo `.mdj` de StarUML.

## Cambios de software implementados
- Autenticacion y autorizacion por rol verificadas en el backend.
- Asignacion de credenciales desde la aplicacion para usuarios activos.
- Invalidacion de sesiones existentes al inactivar una cuenta.
- Tarifas: automÃ³vil y camioneta COP $250.000 por mes; motocicleta COP $100.000 por mes.
- Nuevo endpoint administrativo `GET /api/pagos`.
- Filtros por estado, placa, fechas y paginaciÃ³n.
- Indicadores de aprobados, pendientes, rechazados y recaudo aprobado.
- PestaÃ±a de interfaz GestiÃ³n de pagos, visible solo para Administrador.
- Pruebas de IteraciÃ³n 3 aÃ±adidas en `tests/iteracion3.test.js`.

## Base de datos
No se requiere cambio estructural en PostgreSQL para esta iteraciÃ³n: se reutilizan las tablas `Pago`, `Mensualidad`, `Vehiculo` y `Usuario`. Las tarifas nuevas viven en `config/tarifas.js`. Los registros histÃ³ricos existentes no se modifican automÃ¡ticamente.

## Diagramas de secuencia complementarios

Se incorporan nueve diagramas SVG en la carpeta docs/diagramas/secuencia_ea3_actualizados/:
- SD_01_registrar_ingreso.svg
- SD_02_registrar_salida.svg
- SD_03_mensualidad_y_pago.svg
- SD_04_registrar_usuario.svg
- SD_05_inactivar_usuario.svg
- SD_06_registrar_vehiculo.svg
- SD_07_registrar_celda.svg
- SD_08_eliminar_celda.svg
- SD_09_login_roles.svg

Estos archivos son versiones complementarias en formato SVG. La carpeta contiene nueve diagramas de secuencia y un diagrama de componentes renderizado.

