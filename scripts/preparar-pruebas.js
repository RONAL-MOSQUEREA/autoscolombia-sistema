// Crea/restaura una BD EXCLUSIVA para pruebas. Nunca se conecta a DB_NAME.
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const baseProduccion = process.env.DB_NAME || 'autoscolombiadb';
const nombre = process.env.DB_TEST_NAME || `${baseProduccion}_test`;
if (!/^[a-zA-Z0-9_]+$/.test(nombre) || !/(?:_test|_pruebas)$/i.test(nombre) || nombre === baseProduccion) {
    throw new Error('DB_TEST_NAME debe ser una base separada y terminar en _test o _pruebas.');
}
const opciones = {
    host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres', password: process.env.DB_PASSWORD || '',
    connectionTimeoutMillis: 10000
};

(async () => {
    const admin = new Pool({ ...opciones, database: 'postgres' });
    try {
        const { rows } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [nombre]);
        if (!rows.length) {
            await admin.query(`CREATE DATABASE "${nombre}"`);
            console.log(`Base de pruebas creada: ${nombre}`);
        } else {
            console.log(`La base de pruebas ${nombre} ya existe; se reconstruirá porque es exclusiva para pruebas.`);
        }
    } finally { await admin.end(); }

    const testPool = new Pool({ ...opciones, database: nombre });
    try {
        const actual = (await testPool.query('SELECT current_database() AS n')).rows[0].n;
        if (actual !== nombre || !/(?:_test|_pruebas)$/i.test(actual)) throw new Error('La protección de base de pruebas no pasó.');
        const sql = fs.readFileSync(path.join(__dirname, '..', 'database', 'script_pg.sql'), 'utf8');
        await testPool.query(sql);
        console.log(`Esquema y datos de ejemplo instalados en ${nombre}.`);
        console.log('Esta operación solo reconstruye la base exclusiva de pruebas.');
    } finally { await testPool.end(); }
})().catch(e => { console.error('No se pudo preparar la BD de pruebas:', e.message); process.exitCode = 1; });
