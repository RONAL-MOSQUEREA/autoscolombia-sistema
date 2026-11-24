// Capa DataAccess - Usuario. `ex` = pool o cliente de transacciÃ³n.
const { Usuario } = require('../models');

const COLUMNAS_EDITABLES = ['nombre', 'documento', 'telefono', 'correo', 'tipo_usuario'];

// Escapa % y _ para que el texto del usuario se busque literalmente con ILIKE
const comodin = (texto) => '%' + String(texto).replace(/[\\%_]/g, '\\$&') + '%';

exports.crear = async (ex, { nombre, documento, telefono = null, correo = null, tipo_usuario = 'Cliente' }) => {
    const { rows } = await ex.query(
        `INSERT INTO Usuario (nombre, documento, telefono, correo, tipo_usuario)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`, [nombre, documento, telefono, correo, tipo_usuario]);
    return new Usuario(rows[0]);
};

exports.buscarPorId = async (ex, id, { bloquear = false } = {}) => {
    const { rows } = await ex.query(
        `SELECT * FROM Usuario WHERE id_usuario = $1 ${bloquear ? 'FOR UPDATE' : ''}`, [id]);
    return rows.length ? new Usuario(rows[0]) : null;
};

exports.buscarPorDocumento = async (ex, documento) => {
    const { rows } = await ex.query('SELECT * FROM Usuario WHERE documento = $1', [documento]);
    return rows.length ? new Usuario(rows[0]) : null;
};

// BÃºsqueda por nombre, documento, correo o placa de alguno de sus vehÃ­culos
exports.listar = async (ex, { buscar = null, tipo = null, estado = null, limite = 50, desplazamiento = 0 } = {}) => {
    const patron = buscar ? comodin(buscar) : null;
    const filtro = `
        WHERE ($1::text IS NULL OR u.nombre ILIKE $1 ESCAPE '\\' OR u.documento ILIKE $1 ESCAPE '\\'
               OR u.correo ILIKE $1 ESCAPE '\\'
               OR EXISTS (SELECT 1 FROM Vehiculo v WHERE v.id_usuario = u.id_usuario AND v.placa ILIKE $1 ESCAPE '\\'))
          AND ($2::text IS NULL OR u.tipo_usuario = $2)
          AND ($3::text IS NULL OR u.estado = $3)`;
    const { rows: [{ total }] } = await ex.query(`SELECT COUNT(*)::int AS total FROM Usuario u ${filtro}`, [patron, tipo, estado]);
    const { rows } = await ex.query(
        `SELECT u.id_usuario,u.nombre,u.documento,u.telefono,u.correo,u.tipo_usuario,u.estado,u.fecha_registro,
                (SELECT COUNT(*)::int FROM Vehiculo v WHERE v.id_usuario = u.id_usuario) AS total_vehiculos
         FROM Usuario u ${filtro} ORDER BY u.nombre, u.id_usuario LIMIT $4 OFFSET $5`,
        [patron, tipo, estado, limite, desplazamiento]);
    return { total, usuarios: rows };
};

// Actualiza solo las columnas permitidas que vengan en `campos`
exports.actualizar = async (ex, id, campos) => {
    const claves = Object.keys(campos).filter(k => COLUMNAS_EDITABLES.includes(k));
    if (!claves.length) return null;
    const sets = claves.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const { rows } = await ex.query(
        `UPDATE Usuario SET ${sets} WHERE id_usuario = $${claves.length + 1} RETURNING *`,
        [...claves.map(k => campos[k]), id]);
    return rows.length ? new Usuario(rows[0]) : null;
};

exports.cambiarEstado = async (ex, id, estado) =>
    ex.query('UPDATE Usuario SET estado = $1 WHERE id_usuario = $2', [estado, id]);

// Asigna credenciales únicamente a usuarios activos; nunca devuelve el hash.
exports.asignarCredenciales = async (ex, id, { usuario_login, password_hash }) => {
    const { rows } = await ex.query(
        'UPDATE Usuario SET usuario_login = $1, password_hash = $2 WHERE id_usuario = $3 AND estado = $4 RETURNING id_usuario, nombre, usuario_login, tipo_usuario, estado',
        [usuario_login, password_hash, id, 'Activo']);
    return rows.length ? new Usuario(rows[0]) : null;
};

