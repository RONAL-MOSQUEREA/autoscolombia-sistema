const { lanzarSiHayErrores } = require('./validacion');
const DomainError = require('./DomainError');

const TIPOS = ['Automovil', 'Motocicleta', 'Camioneta'];

class Vehiculo {
    constructor(fila) { Object.assign(this, fila); }

    // Placas colombianas: ABC123 (carro) o ABC12D (moto)
    static normalizarPlaca(placa) { return String(placa || '').toUpperCase().replace(/[\s-]/g, ''); }
    static esPlacaValida(placa) { return /^[A-Z]{3}\d{2}[A-Z0-9]$/.test(placa); }

    // Valida marca, modelo, color y tipo (la placa y el propietario los valida el servicio).
    static validarDatos(datos = {}, { parcial = false } = {}) {
        const d = datos || {};
        const hay = (k) => d[k] !== undefined;
        const errores = {};
        const limpio = {};
        const texto = (campo, max) => {
            if (!hay(campo)) return;
            const v = String(d[campo] ?? '').trim();
            if (v.length > max) errores[campo] = `${campo} no puede superar ${max} caracteres.`;
            else limpio[campo] = v === '' ? null : v;
        };
        texto('marca', 50); texto('modelo', 50); texto('color', 30);
        if (!parcial || hay('tipo')) {
            if (!TIPOS.includes(d.tipo)) errores.tipo = `El tipo de vehículo debe ser: ${TIPOS.join(', ')}.`;
            else limpio.tipo = d.tipo;
        }
        lanzarSiHayErrores(errores);
        return limpio;
    }
}
Vehiculo.TIPOS = TIPOS;
module.exports = Vehiculo;
