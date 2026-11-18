// BusinessLogic - REGLA RF02: ¿puede ingresar este vehículo según su mensualidad?
const { Mensualidad, DomainError } = require('../models');
const { DIAS_ALERTA_VENCIMIENTO } = require('../config/tarifas');

class ValidadorMensualidad {
    constructor(repos) { this.repos = repos; }

    // Clasifica sin lanzar errores: Vigente | Por vencer | Vencida | Sin mensualidad
    async clasificar(ex, placa, hoy) {
        const vigente = await this.repos.mensualidades.vigente(ex, placa, hoy);
        const ultima = await this.repos.mensualidades.ultimaPagada(ex, placa);
        if (!ultima) return { estado: 'Sin mensualidad', fecha_fin: null, dias_restantes: null, vigente: false };
        const dias = new Mensualidad(ultima).diasRestantes(hoy);
        if (!vigente) {
            return { estado: ultima.estaVencida(hoy) ? 'Vencida' : 'Sin mensualidad',
                     fecha_fin: ultima.fecha_fin, dias_restantes: dias, vigente: false };
        }
        return { estado: dias <= DIAS_ALERTA_VENCIMIENTO ? 'Por vencer' : 'Vigente',
                 fecha_fin: ultima.fecha_fin, dias_restantes: dias, vigente: true };
    }

    // Lanza DomainError si NO puede ingresar. Si puede, devuelve datos de vigencia.
    async validar(ex, vehiculo, hoy) {
        const vigente = await this.repos.mensualidades.vigente(ex, vehiculo.placa, hoy);
        const ultima = await this.repos.mensualidades.ultimaPagada(ex, vehiculo.placa);

        if (!vigente) {
            if (ultima && ultima.estaVencida(hoy)) {
                throw new DomainError('MENSUALIDAD_VENCIDA',
                    `La mensualidad del vehículo ${vehiculo.placa} venció el ${ultima.fecha_fin}. ` +
                    'Debe renovarla para ingresar.', 403, { fecha_fin: ultima.fecha_fin });
            }
            throw new DomainError('SIN_MENSUALIDAD',
                `El vehículo ${vehiculo.placa} no tiene una mensualidad vigente pagada.`, 403);
        }

        // Si hay renovación pagada por adelantado, la vigencia real llega a `ultima.fecha_fin`
        const hasta = ultima.fecha_fin;
        const dias = new Mensualidad(ultima).diasRestantes(hoy);
        const alerta = dias <= DIAS_ALERTA_VENCIMIENTO
            ? `La mensualidad vence en ${dias} día(s) (${hasta}). Recuerde renovarla.` : null;
        return { fecha_fin: hasta, dias_restantes: dias, alerta };
    }
}
module.exports = ValidadorMensualidad;
