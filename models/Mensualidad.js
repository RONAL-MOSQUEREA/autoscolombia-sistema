// La vigencia se define SOLO por fechas (fecha_inicio..fecha_fin) y pago aprobado.
// Las fechas son texto ISO 'YYYY-MM-DD', por eso se comparan como texto.
class Mensualidad {
    constructor(fila) { Object.assign(this, fila); }

    estaPagada() { return this.estado_pago === 'Pagada'; }
    estaVigente(hoy) { return this.estaPagada() && this.fecha_inicio <= hoy && hoy <= this.fecha_fin; }
    estaVencida(hoy) { return this.estaPagada() && this.fecha_fin < hoy; }

    diasRestantes(hoy) {
        const ms = Date.parse(this.fecha_fin) - Date.parse(hoy);
        return Math.round(ms / 86400000);
    }

    // Utilidades de fechas ISO (UTC para evitar problemas de horario de verano)
    static sumarDias(fechaISO, dias) {
        const d = new Date(`${fechaISO}T00:00:00Z`);
        d.setUTCDate(d.getUTCDate() + dias);
        return d.toISOString().slice(0, 10);
    }
}
module.exports = Mensualidad;
