// BusinessLogic - gestión de celdas (Iteración 2; amplía el RF04). Implementa IGestionCeldas.
const { Celda, DomainError } = require('../models');
const { verificarImplementacion } = require('./IGestionCeldas');
const { idPositivo, filtroDeLista } = require('./utilidades');

class GestionCeldas {
    constructor({ enTransaccion, pool, repos }) {
        this.enTransaccion = enTransaccion;
        this.pool = pool;
        this.repos = repos;
        verificarImplementacion(this);
    }

    async _celdaOError(ex, id, bloquear = false) {
        const celda = await this.repos.celdas.buscarPorId(ex, id, { bloquear });
        if (!celda) throw new DomainError('CELDA_NO_ENCONTRADA', 'La celda no existe.', 404);
        return celda;
    }

    // ---- RF14: consultar celdas (filtros opcionales por estado y tipo) ----------
    async consultarCeldas({ estado, tipo } = {}) {
        return this.repos.celdas.listar(this.pool, {
            estado: filtroDeLista(estado, Celda.ESTADOS, 'estado'),
            tipo: filtroDeLista(tipo, Celda.TIPOS, 'tipo')
        });
    }

    // ---- RF15: detalle de una celda (quién la ocupa y cuántas veces se ha usado) --
    async consultarCelda(idCrudo) {
        const id = idPositivo(idCrudo, 'de la celda');
        const celda = await this._celdaOError(this.pool, id);
        const ocupacion = await this.repos.celdas.ocupacionActual(this.pool, id);
        const total_usos = await this.repos.celdas.contarUsos(this.pool, id);
        return { celda, ocupacion_actual: ocupacion || null, total_usos };
    }

    // ---- RF16: registrar una celda nueva (nace 'Disponible') --------------------
    async registrarCelda(datos) {
        const campos = Celda.validarDatos(datos);
        return this.enTransaccion(async (tx) => {
            if (await this.repos.celdas.buscarPorNumero(tx, campos.numero_celda)) {
                throw new DomainError('CELDA_DUPLICADA', `Ya existe la celda número ${campos.numero_celda}.`, 409);
            }
            const celda = await this.repos.celdas.crear(tx, campos);
            return { mensaje: 'Celda registrada exitosamente.', celda };
        });
    }

    // ---- RF17: editar número y/o tipo (nunca mientras está ocupada) -------------
    async actualizarCelda(idCrudo, datos) {
        const id = idPositivo(idCrudo, 'de la celda');
        const campos = Celda.validarDatos(datos, { parcial: true });
        return this.enTransaccion(async (tx) => {
            const actual = await this._celdaOError(tx, id, true);
            if (actual.estado === 'Ocupada') {
                throw new DomainError('CELDA_OCUPADA', 'No se puede editar una celda ocupada.', 409);
            }
            if (campos.numero_celda !== undefined && campos.numero_celda !== actual.numero_celda) {
                if (await this.repos.celdas.buscarPorNumero(tx, campos.numero_celda)) {
                    throw new DomainError('CELDA_DUPLICADA', `Ya existe la celda número ${campos.numero_celda}.`, 409);
                }
            }
            const celda = await this.repos.celdas.actualizar(tx, id, campos);
            return { mensaje: 'Celda actualizada exitosamente.', celda };
        });
    }

    // ---- RF18: cambiar estado (Disponible <-> Mantenimiento) --------------------
    async cambiarEstadoCelda(idCrudo, estado) {
        const id_celda = idPositivo(idCrudo, 'de la celda');
        if (!['Disponible', 'Mantenimiento'].includes(estado)) {
            throw new DomainError('ESTADO_INVALIDO', "Solo se permite 'Disponible' o 'Mantenimiento'.", 400);
        }
        return this.enTransaccion(async (tx) => {
            const celda = await this._celdaOError(tx, id_celda, true);
            if (celda.estado === 'Ocupada') {
                throw new DomainError('CELDA_OCUPADA', 'No se puede cambiar el estado de una celda ocupada.', 409);
            }
            await this.repos.celdas.cambiarEstado(tx, celda.id_celda, estado);
            return { mensaje: 'Estado de la celda actualizado.', id_celda: celda.id_celda, estado };
        });
    }

    // ---- RF19: eliminar una celda (solo si nunca se ha usado) -------------------
    async eliminarCelda(idCrudo) {
        const id = idPositivo(idCrudo, 'de la celda');
        return this.enTransaccion(async (tx) => {
            const celda = await this._celdaOError(tx, id, true);
            if (celda.estado === 'Ocupada') {
                throw new DomainError('CELDA_OCUPADA', 'No se puede eliminar una celda ocupada.', 409);
            }
            if (await this.repos.celdas.contarUsos(tx, id) > 0) {
                throw new DomainError('CELDA_CON_HISTORIAL',
                    'La celda tiene historial de ingresos y no se puede eliminar. Póngala en Mantenimiento para retirarla de servicio.', 409);
            }
            await this.repos.celdas.eliminar(tx, id);
            return { mensaje: 'Celda eliminada exitosamente.', id_celda: id, numero_celda: celda.numero_celda };
        });
    }
}

module.exports = GestionCeldas;
