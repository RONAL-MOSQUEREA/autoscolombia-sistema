// Valor de la MENSUALIDAD por tipo de vehículo (COP). No existe tarifa por hora.
// Ajustar a los valores reales del parqueadero.
module.exports = {
    DIAS_POR_MENSUALIDAD: 30,
    DIAS_ALERTA_VENCIMIENTO: 5,
    // Un pago pendiente bloquea nuevas solicitudes de la misma placa hasta que se confirme
    // o pasen estas horas (entonces se anula solo y se permite generar uno nuevo).
    HORAS_EXPIRA_PAGO_PENDIENTE: 24,
    VALOR: { Automovil: 180000, Camioneta: 220000, Motocicleta: 80000 }
};
