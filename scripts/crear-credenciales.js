require('dotenv').config();
const { pool } = require('../config/db');
const { hashPassword } = require('../auth');
(async () => {
  const [id, usuario, password] = process.argv.slice(2);
  if (!id || !usuario || !password || password.length < 10) {
    console.error('Uso: npm run usuario:credenciales -- <id_usuario> <usuario_login> <contraseña-de-10-o-más-caracteres>');
    process.exitCode = 1; return;
  }
  try {
    await pool.query('ALTER TABLE Usuario ADD COLUMN IF NOT EXISTS usuario_login VARCHAR(40)');
    await pool.query('ALTER TABLE Usuario ADD COLUMN IF NOT EXISTS password_hash VARCHAR(200)');
    await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS uq_usuario_login_lower ON Usuario (LOWER(usuario_login)) WHERE usuario_login IS NOT NULL');
    const r = await pool.query('UPDATE Usuario SET usuario_login=$1,password_hash=$2 WHERE id_usuario=$3 AND estado=\'Activo\' RETURNING id_usuario,nombre,tipo_usuario,usuario_login', [usuario, hashPassword(password), Number(id)]);
    if (!r.rowCount) throw new Error('Usuario no encontrado o inactivo.');
    console.log('Credenciales creadas:', r.rows[0]);
  } catch (e) { console.error(e.code === '23505' ? 'Ese nombre de usuario ya existe.' : e.message); process.exitCode = 1; }
  finally { await pool.end(); }
})();
