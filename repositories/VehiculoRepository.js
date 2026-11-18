// Capa DataAccess. `ex` = pool o cliente de transacción (ambos tienen .query(sql, parametros)).
const { Vehiculo } = require('../models');

const COLUMNAS_EDITABLES = ['marca', 'modelo', 'color', 'tipo', 'id_usuario'];

exports.buscarPorPlaca = async (ex, placa, { bloquear = false } = {}) => {
    const { rows } = await ex.query(
        `SELECT * FROM Vehiculo WHERE placa = $1 ${bloquear ? 'FOR UPDATE' : ''}`, [placa]);
    return rows.length ? new Vehiculo(rows[0]) : null;
};

exports.crear = async (ex, { placa, id_usuario, marca = null, modelo = null, color = null, tipo }) => {
    const { rows } = await ex.query(
        `INSERT INTO Vehiculo (placa, id_usuario, marca, modelo, color, tipo)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`, [placa, id_usuario, marca, modelo, color, tipo]);
    return new Vehiculo(rows[0]);
};

exports.listarPorUsuario = async (ex, id_usuario) => {
    const { rows } = await ex.query('SELECT * FROM Vehiculo WHERE id_usuario = $1 ORDER BY placa', [id_usuario]);
    return rows.map(f => new Vehiculo(f));
};

exports.actualizar = async (ex, placa, campos) => {
    const claves = Object.keys(campos).filter(k => COLUMNAS_EDITABLES.includes(k));
    if (!claves.length) return null;
    const sets = claves.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const { rows } = await ex.query(
        `UPDATE Vehiculo SET ${sets} WHERE placa = $${claves.length + 1} RETURNING *`,
        [...claves.map(k => campos[k]), placa]);
    return rows.length ? new Vehiculo(rows[0]) : null;
};
