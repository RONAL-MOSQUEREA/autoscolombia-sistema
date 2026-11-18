const { DomainError } = require('../models');

// Convierte un identificador recibido por URL ("12", "abc", "-3") en entero positivo o lanza 400.
exports.idPositivo = (crudo, de) => {
    const n = Number(crudo);
    if (!Number.isInteger(n) || n < 1) {
        throw new DomainError('ID_INVALIDO', `El identificador ${de} debe ser un entero positivo.`, 400);
    }
    return n;
};

// Valida un filtro opcional de listado: vacío -> null; fuera de la lista -> 400
exports.filtroDeLista = (valor, permitidos, nombre) => {
    if (valor === undefined || valor === null || valor === '') return null;
    if (!permitidos.includes(valor)) {
        throw new DomainError('FILTRO_INVALIDO', `El filtro ${nombre} debe ser uno de: ${permitidos.join(', ')}.`, 400);
    }
    return valor;
};
