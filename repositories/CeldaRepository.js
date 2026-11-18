const { Celda } = require('../models');

exports.listar = async (ex, { estado = null, tipo = null } = {}) => {
    const { rows } = await ex.query(
        `SELECT * FROM Celda WHERE ($1::text IS NULL OR estado = $1) AND ($2::text IS NULL OR tipo = $2)
         ORDER BY numero_celda`, [estado, tipo]);
    return rows.map(f => new Celda(f));
};

exports.buscarPorNumero = async (ex, numero) => {
    const { rows } = await ex.query('SELECT * FROM Celda WHERE numero_celda = $1', [numero]);
    return rows.length ? new Celda(rows[0]) : null;
};

exports.crear = async (ex, { numero_celda, tipo }) => {
    const { rows } = await ex.query(
        `INSERT INTO Celda (numero_celda, estado, tipo) VALUES ($1, 'Disponible', $2) RETURNING *`, [numero_celda, tipo]);
    return new Celda(rows[0]);
};

const COLUMNAS_EDITABLES = ['numero_celda', 'tipo'];
exports.actualizar = async (ex, id, campos) => {
    const claves = Object.keys(campos).filter(k => COLUMNAS_EDITABLES.includes(k));
    if (!claves.length) return null;
    const sets = claves.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const { rows } = await ex.query(
        `UPDATE Celda SET ${sets} WHERE id_celda = $${claves.length + 1} RETURNING *`,
        [...claves.map(k => campos[k]), id]);
    return rows.length ? new Celda(rows[0]) : null;
};

exports.eliminar = async (ex, id) => ex.query('DELETE FROM Celda WHERE id_celda = $1', [id]);

// ¿Alguna vez se usó la celda? (si sí, no se puede borrar: se pierde la trazabilidad)
exports.contarUsos = async (ex, id) => {
    const { rows } = await ex.query('SELECT COUNT(*)::int AS n FROM RegistroAcceso WHERE id_celda = $1', [id]);
    return rows[0].n;
};

// Vehículo que ocupa la celda en este momento (o undefined)
exports.ocupacionActual = async (ex, id) => {
    const { rows } = await ex.query(
        `SELECT placa, codigo_ticket, fecha_entrada FROM RegistroAcceso
         WHERE id_celda = $1 AND estado_acceso = 'En Parqueadero'`, [id]);
    return rows[0];
};

exports.buscarPorId = async (ex, id, { bloquear = false } = {}) => {
    const { rows } = await ex.query(
        `SELECT * FROM Celda WHERE id_celda = $1 ${bloquear ? 'FOR UPDATE' : ''}`, [id]);
    return rows.length ? new Celda(rows[0]) : null;
};

// Celdas libres de los tipos indicados; primero la del tipo exacto, luego 'General'.
// Sin LIMIT a propósito: en PostgreSQL, "ORDER BY ... LIMIT 1 FOR UPDATE" puede devolver 0 filas
// aunque queden celdas libres si otra transacción acaba de ocupar la primera.
exports.disponiblesDeTipos = async (ex, tipos) => {
    const { rows } = await ex.query(
        `SELECT * FROM Celda WHERE estado = 'Disponible' AND tipo = ANY($1::text[])
         ORDER BY (tipo = 'General'), numero_celda FOR UPDATE`, [tipos]);
    return rows.map(f => new Celda(f));
};

exports.cambiarEstado = async (ex, id, estado) =>
    ex.query('UPDATE Celda SET estado = $1 WHERE id_celda = $2', [estado, id]);

// Libera solo si estaba ocupada (no pisa una celda puesta en mantenimiento)
exports.liberar = async (ex, id) =>
    ex.query(`UPDATE Celda SET estado = 'Disponible' WHERE id_celda = $1 AND estado = 'Ocupada'`, [id]);
