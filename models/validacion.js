// Utilidad compartida por los modelos: reúne TODOS los errores de un formulario y los lanza juntos.
const DomainError = require('./DomainError');

function lanzarSiHayErrores(errores) {
    const campos = Object.keys(errores);
    if (campos.length) {
        throw new DomainError('DATOS_INVALIDOS', 'Datos inválidos: ' + Object.values(errores).join(' '), 400, { campos: errores });
    }
}
module.exports = { lanzarSiHayErrores };
