const { pool } = require('../config/db');
const { hashPassword } = require('../middlewares/auth');

async function seed() {
    const adminHash = hashPassword('Admin123*');
    const opHash = hashPassword('Operador123*');
    await pool.query(`UPDATE Usuario SET password_hash = $1 WHERE username = 'admin_prueba'`, [adminHash]);
    await pool.query(`UPDATE Usuario SET password_hash = $1 WHERE username = 'operador_prueba'`, [opHash]);
    console.log('Credenciales de prueba actualizadas: admin_prueba / Admin123* y operador_prueba / Operador123*');
    await pool.end();
}
seed().catch(console.error);
