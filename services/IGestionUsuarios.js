// Contrato (interfaz) de la gestiÃ³n de usuarios y vehÃ­culos - IteraciÃ³n 2.
const METODOS = [
    'registrarUsuario',      // RF07
    'consultarUsuarios',     // RF08
    'consultarUsuario',      // RF09
    'actualizarUsuario',     // RF10
    'cambiarEstadoUsuario',  // RF11
    'asignarCredenciales',   // Seguridad: asignación desde la aplicación
    'registrarVehiculo',     // RF12
    'actualizarVehiculo'     // RF13
];
function verificarImplementacion(objeto) {
    const faltantes = METODOS.filter(m => typeof objeto[m] !== 'function');
    if (faltantes.length) throw new Error('ImplementaciÃ³n incompleta de IGestionUsuarios. Faltan: ' + faltantes.join(', '));
    return objeto;
}
module.exports = { METODOS, verificarImplementacion };

