# Historias de usuario — Iteración 3: Gestión de pagos

## HU20 — Consultar historial de pagos
**Como** Administrador, **quiero** consultar los pagos realizados y pendientes, **para** tener trazabilidad de las transacciones de los clientes.

**Criterios de aceptación**
- Dado que inicié sesión como Administrador, cuando ingreso a Gestión de pagos, entonces veo fecha, referencia, propietario, placa, periodo, método, valor y estado.
- Dado que no existen resultados, entonces se informa que no hay pagos coincidentes sin mostrar una tabla engañosa.
- Dado que soy Operario o Cliente, cuando intento consultar el endpoint administrativo, entonces el servidor rechaza el acceso.

## HU21 — Filtrar por estado y placa
**Como** Administrador, **quiero** filtrar el historial por estado y placa, **para** localizar una transacción específica.

**Criterios de aceptación**
- Puedo seleccionar Pendiente, Aprobado, Rechazado o Todos.
- La búsqueda por placa normaliza espacios y guiones.
- Los filtros se combinan y solo se muestran coincidencias.

## HU22 — Consultar pagos por rango de fechas
**Como** Administrador, **quiero** definir una fecha inicial y final, **para** revisar transacciones de un periodo.

**Criterios de aceptación**
- Las fechas deben ser fechas reales en formato AAAA-MM-DD.
- La fecha inicial no puede ser posterior a la fecha final.
- Los filtros inválidos se responden con error de validación y no ejecutan la consulta.

## HU23 — Visualizar resumen financiero
**Como** Administrador, **quiero** ver los totales de pagos aprobados, pendientes y rechazados, además del valor recaudado, **para** conocer el comportamiento de los pagos.

**Criterios de aceptación**
- Los indicadores muestran cantidades por estado.
- El total recaudado suma exclusivamente pagos aprobados.
- Los indicadores se mantienen globales y la tabla refleja los filtros seleccionados.

## HU24 — Generar mensualidad con tarifa correspondiente
**Como** Administrador, **quiero** generar el pago de una mensualidad según el tipo de vehículo, **para** cobrar el valor definido por el parqueadero.

**Criterios de aceptación**
- Automóvil/camioneta: $250.000 por mes.
- Motocicleta: $100.000 por mes.
- El monto total corresponde a tarifa mensual multiplicada por cantidad de meses.
- La mensualidad permanece Pendiente hasta que se reciba confirmación aprobada.

## HU25 — Confirmar resultado del pago
**Como** sistema de pagos, **quiero** notificar el resultado mediante una referencia única, **para** que Autos Colombia actualice el pago y la mensualidad de forma consistente.

**Criterios de aceptación**
- Solo se aceptan estados Aprobado o Rechazado.
- Si existe secreto configurado, el webhook debe presentar el encabezado válido.
- La confirmación es transaccional y no permite reprocesar un pago ya procesado.

---

# Historias transversales de autenticación y autorización

## HU26 - Iniciar sesión y acceder según el rol
**Como** usuario registrado, **quiero** iniciar sesión con mis credenciales, **para** acceder únicamente a las funciones permitidas para mi perfil.

**Criterios de aceptación**
- El sistema valida el nombre de usuario y la contraseña registrados.
- Si las credenciales son válidas, crea una sesión mediante una cookie HttpOnly.
- El rol se obtiene de la cuenta registrada y no puede elegirse desde el formulario.
- El Administrador puede gestionar usuarios, vehículos, celdas, mensualidades y operaciones.
- El Operario puede realizar operaciones y consultas autorizadas, pero no administrar usuarios, celdas ni mensualidades.
- El Cliente solo puede consultar su propia ficha y sus vehículos.
- Las solicitudes sin sesión válida o sin permisos reciben una respuesta de acceso denegado.

## HU27 - Asignar credenciales a un usuario
**Como** Administrador, **quiero** asignar desde el módulo Usuarios un nombre de acceso y una contraseña a un usuario activo, **para** habilitar su ingreso al sistema.

**Criterios de aceptación**
- La funcionalidad está disponible únicamente para el Administrador.
- El formulario se presenta en el detalle de usuarios activos.
- El nombre de usuario debe cumplir el formato permitido y no estar duplicado.
- La contraseña debe tener al menos 10 caracteres.
- El backend almacena la contraseña mediante hash seguro y nunca devuelve el hash.
- No se permite asignar credenciales a una cuenta inactiva.
- La operación se realiza mediante PATCH /api/usuarios/:id/credenciales.

## HU28 - Invalidar sesiones al inactivar una cuenta
**Como** Administrador, **quiero** que las sesiones de un usuario pierdan acceso al inactivar su cuenta, **para** impedir que continúe utilizando permisos anteriores.

**Criterios de aceptación**
- Las solicitudes protegidas consultan el estado actualizado del usuario.
- Una sesión perteneciente a una cuenta inactiva no puede acceder a recursos protegidos.
- El servidor elimina el token de sesión, expira la cookie y responde HTTP 401 con el código CUENTA_INACTIVA.
- La comprobación también se aplica a sesiones iniciadas antes de la inactivación.
- Al reactivar la cuenta, el usuario debe iniciar sesión nuevamente si su sesión anterior fue invalidada.
