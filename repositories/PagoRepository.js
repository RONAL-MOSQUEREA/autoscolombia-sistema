const { Pago } = require('../models');

exports.crear = async (ex, { id_mensualidad, monto, metodo_pago, referencia_externa }) => {
    const { rows } = await ex.query(
        `INSERT INTO Pago (id_mensualidad, monto, metodo_pago, referencia_externa, estado_pago)
         VALUES ($1, $2, $3, $4, 'Pendiente') RETURNING id_pago`,
        [id_mensualidad, monto, metodo_pago, referencia_externa]);
    return rows[0].id_pago;
};

exports.buscarPorReferencia = async (ex, referencia, { bloquear = false } = {}) => {
    const { rows } = await ex.query(
        `SELECT * FROM Pago WHERE referencia_externa = $1 ${bloquear ? 'FOR UPDATE' : ''}`, [referencia]);
    return rows.length ? new Pago(rows[0]) : null;
};

// Pagos aún sin confirmar de una placa, con su antigüedad en horas
exports.pendientesDePlaca = async (ex, placa) => {
    const { rows } = await ex.query(
        `SELECT p.*, FLOOR(EXTRACT(EPOCH FROM (LOCALTIMESTAMP(0) - p.fecha_pago)) / 3600)::int AS horas
         FROM Pago p JOIN Mensualidad m ON m.id_mensualidad = p.id_mensualidad
         WHERE m.placa = $1 AND p.estado_pago = 'Pendiente' ORDER BY p.id_pago`, [placa]);
    return rows.map(f => new Pago(f));
};

exports.cambiarEstado = async (ex, id, estado) =>
    ex.query('UPDATE Pago SET estado_pago = $1 WHERE id_pago = $2', [estado, id]);
