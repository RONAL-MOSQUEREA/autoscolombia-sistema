const { RegistroAcceso } = require('../models');

// Minutos transcurridos entre dos instantes (equivale a TIMESTAMPDIFF(MINUTE, ...) de MySQL)
const MINUTOS = (desde, hasta) => `FLOOR(EXTRACT(EPOCH FROM (${hasta} - ${desde})) / 60)::int`;

exports.crear = async (ex, { placa, id_celda, codigo_ticket }) => {
    const { rows } = await ex.query(
        `INSERT INTO RegistroAcceso (placa, id_celda, codigo_ticket, fecha_entrada, estado_acceso)
         VALUES ($1, $2, $3, LOCALTIMESTAMP(0), 'En Parqueadero') RETURNING id_registro`,
        [placa, id_celda, codigo_ticket]);
    return rows[0].id_registro;
};

exports.buscarActivoPorPlaca = async (ex, placa, { bloquear = false } = {}) => {
    const { rows } = await ex.query(
        `SELECT * FROM RegistroAcceso WHERE placa = $1 AND estado_acceso = 'En Parqueadero'
         ${bloquear ? 'FOR UPDATE' : ''}`, [placa]);
    return rows.length ? new RegistroAcceso(rows[0]) : null;
};

exports.buscarActivoPorTicket = async (ex, ticket, { bloquear = false } = {}) => {
    const { rows } = await ex.query(
        `SELECT * FROM RegistroAcceso WHERE codigo_ticket = $1 AND estado_acceso = 'En Parqueadero'
         ${bloquear ? 'FOR UPDATE' : ''}`, [ticket]);
    return rows.length ? new RegistroAcceso(rows[0]) : null;
};

exports.finalizar = async (ex, id) =>
    ex.query(`UPDATE RegistroAcceso SET fecha_salida = LOCALTIMESTAMP(0), estado_acceso = 'Finalizado'
              WHERE id_registro = $1`, [id]);

exports.obtenerConPermanencia = async (ex, id) => {
    const { rows } = await ex.query(
        `SELECT *, ${MINUTOS('fecha_entrada', 'COALESCE(fecha_salida, LOCALTIMESTAMP(0))')} AS minutos
         FROM RegistroAcceso WHERE id_registro = $1`, [id]);
    return rows[0];
};

// Vehículos que están dentro ahora (para el dashboard)
exports.activos = async (ex) => {
    const { rows } = await ex.query(
        `SELECT r.id_registro, r.placa, r.codigo_ticket, c.numero_celda, r.fecha_entrada,
                ${MINUTOS('r.fecha_entrada', 'LOCALTIMESTAMP(0)')} AS minutos
         FROM RegistroAcceso r JOIN Celda c ON c.id_celda = r.id_celda
         WHERE r.estado_acceso = 'En Parqueadero' ORDER BY r.fecha_entrada`);
    return rows;
};
