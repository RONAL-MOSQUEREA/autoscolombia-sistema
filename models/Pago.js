class Pago {
    constructor(fila) { Object.assign(this, fila); }
    estaPendiente() { return this.estado_pago === 'Pendiente'; }
    estaAprobado() { return this.estado_pago === 'Aprobado'; }

    static generarReferencia() {
        const crypto = require('crypto');
        return 'PAY-' + Date.now().toString(36).toUpperCase() + crypto.randomBytes(2).toString('hex').toUpperCase();
    }
}
module.exports = Pago;
