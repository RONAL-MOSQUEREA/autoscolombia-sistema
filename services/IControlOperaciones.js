// Contrato (interfaz) que la capa Presentation consume.
// JavaScript no tiene `interface`, así que el contrato se declara aquí y se
// verifica al arrancar (ver verificarImplementacion).
const METODOS = [
    'registrarIngreso',       // RF01 + RF02 (valida mensualidad, asigna celda)
    'consultarEstadoVehiculo',// RF02 (estado de mensualidad ANTES de ingresar)
    'registrarSalida',        // RF03
    'consultarDashboard',     // RF04
    'registrarNovedad',       // RF05
    'consultarNovedades',     // RF05
    'registrarMensualidad',   // RF06
    'confirmarPago'           // RF06 (callback del Sistema de Pago)
];

function verificarImplementacion(objeto) {
    const faltantes = METODOS.filter(m => typeof objeto[m] !== 'function');
    if (faltantes.length) {
        throw new Error('Implementación incompleta de IControlOperaciones. Faltan: ' + faltantes.join(', '));
    }
    return objeto;
}

module.exports = { METODOS, verificarImplementacion };
