const DomainError = require('./DomainError');
const { lanzarSiHayErrores } = require('./validacion');

const TIPOS = ['Automovil', 'Motocicleta', 'General'];
const ESTADOS = ['Disponible', 'Ocupada', 'Mantenimiento'];

class Celda {
    constructor(fila) { Object.assign(this, fila); }

    estaDisponible() { return this.estado === 'Disponible'; }

    // Qué tipos de celda sirven para cada tipo de vehículo (regla de compatibilidad)
    static tiposCompatibles(tipoVehiculo) {
        if (tipoVehiculo === 'Motocicleta') return ['Motocicleta', 'General'];
        return ['Automovil', 'General']; // Automovil y Camioneta
    }
    esCompatibleCon(vehiculo) { return Celda.tiposCompatibles(vehiculo.tipo).includes(this.tipo); }

    // Valida el número y el tipo de una celda (alta o actualización parcial)
    static validarDatos(datos = {}, { parcial = false } = {}) {
        const d = datos || {};
        const hay = (k) => d[k] !== undefined;
        const errores = {};
        const limpio = {};
        if (!parcial || hay('numero_celda')) {
            const n = typeof d.numero_celda === 'string' && d.numero_celda.trim() !== '' ? Number(d.numero_celda) : d.numero_celda;
            if (!Number.isInteger(n) || n < 1 || n > 9999) errores.numero_celda = 'El número de celda debe ser un entero entre 1 y 9999.';
            else limpio.numero_celda = n;
        }
        if (hay('tipo') || !parcial) {
            const v = d.tipo === undefined ? 'General' : d.tipo;
            if (!TIPOS.includes(v)) errores.tipo = `El tipo de celda debe ser: ${TIPOS.join(', ')}.`;
            else limpio.tipo = v;
        }
        lanzarSiHayErrores(errores);
        if (parcial && Object.keys(limpio).length === 0) {
            throw new DomainError('DATOS_INCOMPLETOS', 'Indique al menos un campo a actualizar (numero_celda o tipo).', 400);
        }
        return limpio;
    }
}
Celda.TIPOS = TIPOS;
Celda.ESTADOS = ESTADOS;
module.exports = Celda;
