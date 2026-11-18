const express = require('express');
const { hashPassword, verifyPassword, crearSesion, destruirSesion, requireAuth } = require('../auth');

module.exports = (pool) => {
  const router = express.Router();
  router.post('/login', async (req, res, next) => {
    try {
      const { usuario, password } = req.body || {};
      if (!usuario || !password) return res.status(400).json({ error: 'Ingrese usuario y contraseña.' });
      const { rows } = await pool.query(
        `SELECT id_usuario, nombre, usuario_login, password_hash, tipo_usuario, estado
         FROM Usuario WHERE LOWER(usuario_login) = LOWER($1) LIMIT 1`, [String(usuario).trim()]);
      const u = rows[0];
      if (!u || u.estado !== 'Activo' || !verifyPassword(password, u.password_hash))
        return res.status(401).json({ error: 'Usuario o contraseña incorrectos, o cuenta inactiva.' });
      crearSesion(res, u);
      res.json({ usuario: { id: u.id_usuario, nombre: u.nombre, usuario: u.usuario_login, rol: u.tipo_usuario } });
    } catch (e) { next(e); }
  });
  router.post('/logout', (req, res) => { destruirSesion(req, res); res.json({ mensaje: 'Sesión cerrada.' }); });
  router.get('/me', requireAuth, (req, res) => res.json({ usuario: req.user }));
  router.get('/mi-cuenta', requireAuth, async (req, res, next) => {
    try {
      if (req.user.rol !== 'Cliente') return res.status(403).json({ error: 'Esta consulta es exclusiva para clientes.' });
      const { rows } = await pool.query(
        `SELECT u.id_usuario, u.nombre, u.documento, u.telefono, u.correo,
          COALESCE(json_agg(json_build_object('placa',v.placa,'marca',v.marca,'modelo',v.modelo,'tipo',v.tipo,
            'fecha_fin',m.fecha_fin,'estado_pago',m.estado_pago)) FILTER (WHERE v.placa IS NOT NULL), '[]') AS vehiculos
         FROM Usuario u LEFT JOIN Vehiculo v ON v.id_usuario=u.id_usuario
         LEFT JOIN LATERAL (SELECT fecha_fin, estado_pago FROM Mensualidad WHERE placa=v.placa
           ORDER BY fecha_fin DESC LIMIT 1) m ON TRUE
         WHERE u.id_usuario=$1 GROUP BY u.id_usuario`, [req.user.id]);
      res.json({ cuenta: rows[0] });
    } catch (e) { next(e); }
  });
  return router;
};
