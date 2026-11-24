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


// Consulta administrativa del historial de pagos con filtros y paginación.
exports.listar = async (ex, { estado, placa, desde, hasta, pagina = 1, limite = 20 }) => {
    const filtros = [];
    const valores = [];
    const agregar = (sql, valor) => { valores.push(valor); filtros.push(sql.replace('?', `$${valores.length}`)); };
    if (estado) agregar('p.estado_pago = ?', estado);
    if (placa) agregar('UPPER(v.placa) LIKE ?', `%${placa}%`);
    if (desde) agregar('p.fecha_pago::date >= ?::date', desde);
    if (hasta) agregar('p.fecha_pago::date <= ?::date', hasta);
    const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
    const { rows: totalRows } = await ex.query(
        `SELECT COUNT(*)::int AS total FROM Pago p
         JOIN Mensualidad m ON m.id_mensualidad = p.id_mensualidad
         JOIN Vehiculo v ON v.placa = m.placa ${where}`, valores);
    const offset = (pagina - 1) * limite;
    const params = [...valores, limite, offset];
    const { rows } = await ex.query(
        `SELECT p.id_pago, p.id_mensualidad, p.monto, p.fecha_pago, p.metodo_pago,
                p.referencia_externa, p.estado_pago, m.placa, m.fecha_inicio, m.fecha_fin,
                m.estado_pago AS estado_mensualidad, v.tipo AS tipo_vehiculo,
                u.nombre AS propietario
         FROM Pago p
         JOIN Mensualidad m ON m.id_mensualidad = p.id_mensualidad
         JOIN Vehiculo v ON v.placa = m.placa
         JOIN Usuario u ON u.id_usuario = v.id_usuario
         ${where}
         ORDER BY p.fecha_pago DESC, p.id_pago DESC
         LIMIT $${valores.length + 1} OFFSET $${valores.length + 2}`, params);
    return { pagos: rows, total: totalRows[0].total, pagina, limite };
};
