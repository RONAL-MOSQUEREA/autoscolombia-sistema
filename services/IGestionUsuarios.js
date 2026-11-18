// Contrato (interfaz) de la gestión de usuarios y vehículos - Iteración 2.
const METODOS = [
    'registrarUsuario',      // RF07
    'consultarUsuarios',     // RF08
    'consultarUsuario',      // RF09
    'actualizarUsuario',     // RF10
    'cambiarEstadoUsuario',  // RF11
    'registrarVehiculo',     // RF12
    'actualizarVehiculo'     // RF13
];
function verificarImplementacion(objeto) {
    const faltantes = METODOS.filter(m => typeof objeto[m] !== 'function');
    if (faltantes.length) throw new Error('Implementación incompleta de IGestionUsuarios. Faltan: ' + faltantes.join(', '));
    return objeto;
}
module.exports = { METODOS, verificarImplementacion };
