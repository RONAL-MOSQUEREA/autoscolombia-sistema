// Contrato (interfaz) de la gestión de celdas - Iteración 2 (amplía el RF04 de la Iteración 1).
const METODOS = [
    'consultarCeldas',      // RF14
    'consultarCelda',       // RF15
    'registrarCelda',       // RF16
    'actualizarCelda',      // RF17
    'cambiarEstadoCelda',   // RF18
    'eliminarCelda'         // RF19
];
function verificarImplementacion(objeto) {
    const faltantes = METODOS.filter(m => typeof objeto[m] !== 'function');
    if (faltantes.length) throw new Error('Implementación incompleta de IGestionCeldas. Faltan: ' + faltantes.join(', '));
    return objeto;
}
module.exports = { METODOS, verificarImplementacion };
