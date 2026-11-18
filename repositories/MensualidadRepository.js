const { Mensualidad } = require('../models');

exports.fechaActual = async (ex) => {
    const { rows } = await ex.query('SELECT CURRENT_DATE AS hoy');
    return rows[0].hoy; // única fuente de tiempo: la BD ('AAAA-MM-DD')
};

// Mensualidad pagada que cubre la fecha `hoy` (la de vencimiento más lejano)
exports.vigente = async (ex, placa, hoy) => {
    const { rows } = await ex.query(
        `SELECT * FROM Mensualidad WHERE placa = $1 AND estado_pago = 'Pagada'
         AND fecha_inicio <= $2 AND fecha_fin >= $2 ORDER BY fecha_fin DESC LIMIT 1`, [placa, hoy]);
    return rows.length ? new Mensualidad(rows[0]) : null;
};

// Mensualidad pagada con la fecha de vencimiento más lejana
exports.ultimaPagada = async (ex, placa) => {
    const { rows } = await ex.query(
        `SELECT * FROM Mensualidad WHERE placa = $1 AND estado_pago = 'Pagada'
         ORDER BY fecha_fin DESC LIMIT 1`, [placa]);
    return rows.length ? new Mensualidad(rows[0]) : null;
};

// Última fecha cubierta por mensualidades PAGADAS (las pendientes no cuentan: pueden ser rechazadas)
exports.ultimaFechaFin = async (ex, placa) => {
    const { rows } = await ex.query(
        `SELECT MAX(fecha_fin) AS fin FROM Mensualidad
         WHERE placa = $1 AND estado_pago = 'Pagada'`, [placa]);
    return rows[0].fin;
};

exports.crear = async (ex, { placa, fecha_inicio, fecha_fin, valor }) => {
    const { rows } = await ex.query(
        `INSERT INTO Mensualidad (placa, fecha_inicio, fecha_fin, valor, estado_pago)
         VALUES ($1, $2, $3, $4, 'Pendiente') RETURNING id_mensualidad`, [placa, fecha_inicio, fecha_fin, valor]);
    return rows[0].id_mensualidad;
};

exports.cambiarEstado = async (ex, id, estado) =>
    ex.query('UPDATE Mensualidad SET estado_pago = $1 WHERE id_mensualidad = $2', [estado, id]);

// Vigencia más reciente por vehículo (para el dashboard)
exports.vigenciaPorVehiculo = async (ex) => {
    const { rows } = await ex.query(
        `SELECT v.placa, u.nombre AS propietario, MAX(m.fecha_fin) AS fecha_fin
         FROM Vehiculo v
         JOIN Usuario u ON u.id_usuario = v.id_usuario
         LEFT JOIN Mensualidad m ON m.placa = v.placa AND m.estado_pago = 'Pagada'
         GROUP BY v.placa, u.nombre ORDER BY v.placa`);
    return rows;
};
