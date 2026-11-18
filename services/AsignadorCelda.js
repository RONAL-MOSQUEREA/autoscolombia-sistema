// BusinessLogic - REGLA: asignación AUTOMÁTICA de una celda compatible y libre.
const { Celda, DomainError } = require('../models');

class AsignadorCelda {
    constructor(repos) { this.repos = repos; }

    // Devuelve la celda elegida (la del tipo exacto primero, luego 'General').
    async asignar(ex, vehiculo) {
        const candidatas = await this.repos.celdas.disponiblesDeTipos(ex, Celda.tiposCompatibles(vehiculo.tipo));
        if (candidatas.length === 0) {
            throw new DomainError('SIN_CELDA_COMPATIBLE',
                `No hay celdas disponibles para vehículos tipo ${vehiculo.tipo}.`, 409);
        }
        return candidatas[0];
    }
}
module.exports = AsignadorCelda;
