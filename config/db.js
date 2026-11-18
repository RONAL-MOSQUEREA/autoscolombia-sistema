// Capa DataAccess - conexión a PostgreSQL y manejo de transacciones.
const { Pool, types } = require('pg');
require('dotenv').config();

// El driver convierte por defecto DATE/TIMESTAMP en objetos Date (con desfases de zona horaria).
// Se piden como TEXTO ('AAAA-MM-DD' y 'AAAA-MM-DD HH:MM:SS'), que es lo que usa toda la aplicación.
types.setTypeParser(1082, (v) => v);                 // DATE
types.setTypeParser(1114, (v) => v);                 // TIMESTAMP sin zona horaria
types.setTypeParser(20, (v) => parseInt(v, 10));     // BIGINT (resultados de COUNT) -> número

const ZONA_HORARIA = process.env.DB_TIMEZONE || 'America/Bogota';
const modoPruebas = process.env.AUTOSCOL_TEST_MODE === '1';
const baseConfigurada = process.env.DB_NAME || 'autoscolombiadb';
const basePruebas = process.env.DB_TEST_NAME || `${baseConfigurada}_test`;
if (modoPruebas && !/(?:_test|_pruebas)$/i.test(basePruebas)) {
    throw new Error('SEGURIDAD: DB_TEST_NAME debe terminar en _test o _pruebas.');
}

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: modoPruebas ? basePruebas : baseConfigurada,
    max: 10,
    connectionTimeoutMillis: 10000,   // falla rápido si la BD no responde
    // Fechas siempre en formato ISO y "hoy" según la hora del parqueadero (no la del servidor)
    options: `-c datestyle=ISO,YMD -c timezone=${ZONA_HORARIA}`
});

// Sin este manejador, PostgreSQL reiniciándose con conexiones inactivas TUMBA el proceso de Node.
pool.on('error', (error) => console.error('Conexión inactiva con la BD perdida:', error.code || error.message));

// Errores transitorios que se resuelven repitiendo la transacción completa:
//  - 40P01 deadlock / 40001 fallo de serialización (PostgreSQL elige una "víctima")
//  - colisión en claves generadas por la aplicación (ticket / referencia de pago / celda)
const CLAVES_REINTENTABLES = new Set(['uq_acceso_celda_activa', 'uq_acceso_ticket', 'uq_pago_referencia']);
function esReintentable(error) {
    if (error.code === '40P01' || error.code === '40001') return true;
    return error.code === '23505' && CLAVES_REINTENTABLES.has(error.constraint);
}
const pausa = (ms) => new Promise(r => setTimeout(r, ms));

// Ejecuta fn(cliente) dentro de una transacción (commit / rollback automático).
// `fn` debe ser repetible: solo debe tener efectos dentro de la BD.
async function enTransaccion(fn, { intentos = 4 } = {}) {
    for (let intento = 1; ; intento++) {
        const cliente = await pool.connect();
        let descartar = false;
        try {
            await cliente.query('BEGIN');
            const resultado = await fn(cliente);
            await cliente.query('COMMIT');
            return resultado;
        } catch (error) {
            // Si el rollback falla (conexión caída) NO se debe perder el error original
            try { await cliente.query('ROLLBACK'); } catch (_) { descartar = true; }
            if (esReintentable(error) && intento < intentos) {
                await pausa(15 * intento + Math.random() * 35);
                continue;
            }
            throw error;
        } finally {
            cliente.release(descartar); // true = destruir la conexión dañada
        }
    }
}

module.exports = { pool, enTransaccion, esReintentable };
