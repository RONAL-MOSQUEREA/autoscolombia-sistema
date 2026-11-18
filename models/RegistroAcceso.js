class RegistroAcceso {
    constructor(fila) { Object.assign(this, fila); }

    estaActivo() { return this.estado_acceso === 'En Parqueadero'; }

    static generarCodigoTicket() {
        const crypto = require('crypto');
        return 'TK' + Date.now().toString(36).toUpperCase() + crypto.randomBytes(2).toString('hex').toUpperCase();
    }
    static formatearPermanencia(minutos) {
        const h = Math.floor(minutos / 60), m = minutos % 60;
        return h > 0 ? `${h} h ${m} min` : `${m} min`;
    }
}
module.exports = RegistroAcceso;
