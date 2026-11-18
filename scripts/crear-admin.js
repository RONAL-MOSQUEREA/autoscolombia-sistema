require('dotenv').config();
const { pool } = require('../config/db');
const { hashPassword } = require('../auth');
(async () => {
  const [documento, usuario, password] = process.argv.slice(2);
  if (!documento || !usuario || !password || password.length < 10) {
    console.error('Uso: npm run admin:crear -- <documento> <usuario_login> <contraseña-de-10-o-más-caracteres>');
    process.exitCode = 1; return;
  }
  try {
    await pool.query('ALTER TABLE Usuario ADD COLUMN IF NOT EXISTS usuario_login VARCHAR(40)');
    await pool.query('ALTER TABLE Usuario ADD COLUMN IF NOT EXISTS password_hash VARCHAR(200)');
    await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS uq_usuario_login_lower ON Usuario (LOWER(usuario_login)) WHERE usuario_login IS NOT NULL');
    const hash = hashPassword(password);
    const r = await pool.query(`UPDATE Usuario SET usuario_login=$1, password_hash=$2, tipo_usuario='Administrador', estado='Activo'
      WHERE documento=$3 RETURNING id_usuario,nombre,usuario_login,tipo_usuario`, [usuario, hash, documento]);
    if (!r.rowCount) throw new Error('No existe un usuario con ese documento. Cree primero el usuario desde la base de datos o la aplicación.');
    console.log('Cuenta de administrador habilitada:', r.rows[0]);
  } catch (e) { console.error(e.message); process.exitCode = 1; }
  finally { await pool.end(); }
})();
