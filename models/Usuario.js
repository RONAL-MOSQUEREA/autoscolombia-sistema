const DomainError = require('./DomainError');
const { lanzarSiHayErrores } = require('./validacion');

const TIPOS = ['Cliente', 'Operario', 'Administrador'];
const ESTADOS = ['Activo', 'Inactivo'];

class Usuario {
    constructor(fila) { Object.assign(this, fila); delete this.password_hash; }
    esAdministrador() { return this.tipo_usuario === 'Administrador'; }
    esOperario() { return this.tipo_usuario === 'Operario'; }
    esCliente() { return this.tipo_usuario === 'Cliente'; }
    estaActivo() { return this.estado === 'Activo'; }

    // Valida y normaliza los datos de un usuario.
    //  - alta (por defecto): nombre y documento obligatorios; tipo_usuario = 'Cliente' si no se indica.
    //  - parcial (actualización): solo se validan los campos que vienen en `datos`.
    static validarDatos(datos = {}, { parcial = false } = {}) {
        const d = datos || {};
        const hay = (k) => d[k] !== undefined;
        const errores = {};
        const limpio = {};

        if (!parcial || hay('nombre')) {
            const v = String(d.nombre ?? '').trim().replace(/\s+/g, ' ');
            if (!/^\p{L}[\p{L}\s.'-]{2,99}$/u.test(v)) errores.nombre = 'El nombre debe tener entre 3 y 100 letras.';
            else limpio.nombre = v;
        }
        if (!parcial || hay('documento')) {
            const v = String(d.documento ?? '').trim().toUpperCase().replace(/[\s.-]/g, '');
            if (!/^[A-Z0-9]{5,20}$/.test(v)) errores.documento = 'El documento debe tener entre 5 y 20 letras o números.';
            else limpio.documento = v;
        }
        if (hay('telefono')) {
            const v = String(d.telefono ?? '').replace(/[\s()-]/g, '');
            if (v === '') limpio.telefono = null;
            else if (!/^\+?\d{7,15}$/.test(v)) errores.telefono = 'El teléfono debe tener entre 7 y 15 dígitos.';
            else limpio.telefono = v;
        }
        if (hay('correo')) {
            const v = String(d.correo ?? '').trim().toLowerCase();
            if (v === '') limpio.correo = null;
            else if (v.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) errores.correo = 'El correo electrónico no es válido.';
            else limpio.correo = v;
        }
        if (hay('tipo_usuario') || !parcial) {
            const v = d.tipo_usuario === undefined ? 'Cliente' : d.tipo_usuario;
            if (!TIPOS.includes(v)) errores.tipo_usuario = `El tipo de usuario debe ser: ${TIPOS.join(', ')}.`;
            else limpio.tipo_usuario = v;
        }
        lanzarSiHayErrores(errores);
        if (parcial && Object.keys(limpio).length === 0) {
            throw new DomainError('DATOS_INCOMPLETOS', 'Indique al menos un campo a actualizar.', 400);
        }
        return limpio;
    }
}
Usuario.TIPOS = TIPOS;
Usuario.ESTADOS = ESTADOS;
module.exports = Usuario;
