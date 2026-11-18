// Herramienta de línea de comandos para la base de datos (no requiere pgAdmin ni psql).
//   npm run bd:verificar   -> comprueba que la base esté lista para la Iteración 2
//   npm run bd:migrar      -> actualiza una base de la versión anterior SIN perder datos
//   npm run bd:crear -- --si  -> BORRA las 7 tablas y las recrea con datos de ejemplo
// Usa los datos de conexión del archivo .env (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME).
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

const TABLAS = ['usuario', 'vehiculo', 'mensualidad', 'pago', 'celda', 'registroacceso', 'novedad'];
const COLUMNAS_APP = {
    usuario: ['id_usuario','nombre','documento','tipo_usuario','estado','fecha_registro','usuario_login','password_hash'],
    vehiculo: ['placa','id_usuario','tipo'],
    mensualidad: ['id_mensualidad','placa','fecha_inicio','fecha_fin','valor','estado_pago'],
    pago: ['id_pago','id_mensualidad','monto','metodo_pago','referencia_externa','fecha_pago','estado_pago'],
    celda: ['id_celda','numero_celda','tipo','estado'],
    registroacceso: ['id_registro','placa','id_celda','codigo_ticket','fecha_entrada','fecha_salida','estado_acceso'],
    novedad: ['id_novedad','placa','id_registro','descripcion','fecha_hora']
};
const RESTRICCIONES = ['uq_usuario_login_lower', 'uq_usuario_documento', 'uq_celda_numero', 'ck_usuario_estado', 'ck_celda_numero', 'uq_acceso_placa_activa', 'uq_acceso_celda_activa'];
const DOCS_EJEMPLO = ['1017123456', '1020987654', '9999999999', '8888888888', '1030555111', '1030555222'];
const SQL = (n) => path.join(__dirname, '..', 'database', n);

const AYUDA_CONEXION = {
    '28P01': 'La contraseña (DB_PASSWORD) del archivo .env no es la de PostgreSQL.',
    '28000': 'El usuario (DB_USER) del archivo .env no es válido.',
    '3D000': 'La base de datos (DB_NAME) del archivo .env no existe. Créala en pgAdmin con ese nombre exacto.',
    'ECONNREFUSED': 'PostgreSQL está apagado o el puerto (DB_PORT) es incorrecto. Enciende el servicio "postgresql" de Windows.',
    'ETIMEDOUT': 'No se pudo llegar al servidor (DB_HOST / DB_PORT).',
};

async function conectar() {
    try {
        const { rows: [r] } = await pool.query('SELECT current_database() AS base, current_user AS usuario, version() AS version');
        console.log(`Conectado a la base "${r.base}" como "${r.usuario}"`);
        console.log(`Servidor: ${r.version.split(',')[0]}\n`);
        return r.base;
    } catch (e) {
        console.log('[FALTA] No se pudo conectar a PostgreSQL (' + (e.code || e.message) + ')');
        console.log('        ' + (AYUDA_CONEXION[e.code] || 'Revisa los datos de conexión del archivo .env.'));
        process.exitCode = 1;
        return null;
    }
}

async function verificar() {
    if (!await conectar()) return false;
    const faltas = [];
    const ver = (ok, texto, ayuda) => { console.log((ok ? '[OK]    ' : '[FALTA] ') + texto); if (!ok) faltas.push(ayuda || texto); };

    const { rows: tablas } = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'");
    const tienen = new Set(tablas.map(t => t.table_name));
    const sinTabla = TABLAS.filter(t => !tienen.has(t));
    ver(sinTabla.length === 0, sinTabla.length ? `Tablas: faltan ${sinTabla.join(', ')}` : 'Las 7 tablas existen', 'Faltan tablas: ejecuta  npm run bd:crear -- --si');
    if (sinTabla.length) { console.log('\nLa base está vacía o es de otro proyecto. Usa:  npm run bd:crear -- --si'); process.exitCode = 1; return false; }

    const { rows: cols } = await pool.query("SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public'");
    const porTabla = new Map();
    for (const x of cols) { if (!porTabla.has(x.table_name)) porTabla.set(x.table_name, new Set()); porTabla.get(x.table_name).add(x.column_name); }
    const faltanColumnas = [];
    for (const [tabla, esperadas] of Object.entries(COLUMNAS_APP)) {
        const actuales = porTabla.get(tabla) || new Set();
        for (const col of esperadas) if (!actuales.has(col)) faltanColumnas.push(`${tabla}.${col}`);
    }
    ver(faltanColumnas.length === 0, faltanColumnas.length ? `Columnas incompatibles: ${faltanColumnas.join(', ')}` : 'Todas las columnas requeridas por la aplicación existen', 'Faltan columnas del esquema de aplicación; revisa la migración de compatibilidad.');
    const c = porTabla.get('usuario') || new Set();
    const { rows: rs } = await pool.query('SELECT conname FROM pg_constraint WHERE conname = ANY($1)', [RESTRICCIONES]);
    const rest = new Set(rs.map(x => x.conname));
    const { rows: ix } = await pool.query("SELECT indexname FROM pg_indexes WHERE indexname = ANY($1)", [RESTRICCIONES]);
    ix.forEach(i => rest.add(i.indexname));
    const sinRest = RESTRICCIONES.filter(x => !rest.has(x));
    ver(sinRest.length === 0, sinRest.length ? `Restricciones: faltan ${sinRest.join(', ')}` : 'Las restricciones de integridad requeridas existen');

    const n = async (t) => (await pool.query(`SELECT COUNT(*)::int AS n FROM ${t}`)).rows[0].n;
    const u = c.has('estado') ? await n('usuario') : null;
    console.log(`\nDatos: ${u === null ? '?' : u} usuarios · ${await n('vehiculo')} vehículos · ${await n('celda')} celdas · ${await n('mensualidad')} mensualidades`);
    if (c.has('estado')) {
        const { rows: ej } = await pool.query('SELECT COUNT(*)::int AS n FROM usuario WHERE documento = ANY($1)', [DOCS_EJEMPLO]);
        console.log(`Usuarios de ejemplo presentes: ${ej[0].n} de 6` + (ej[0].n < 6 ? '  (solo importa para ejecutar "npm test")' : ''));
    }
    if (faltas.length) {
        console.log('\nRESULTADO: la base NO está lista para la Iteración 2.');
        console.log('Solución: realiza respaldo y ejecuta   npm run bd:migrar -- --respaldo-confirmado   y luego repite   npm run bd:verificar');
        process.exitCode = 1; return false;
    }
    console.log('\nRESULTADO: la base de datos está lista para la Iteración 2.');
    return true;
}

async function ejecutarArchivo(nombre) {
    const sql = fs.readFileSync(SQL(nombre), 'utf8');
    await pool.query(sql);   // el archivo trae varias instrucciones: se envían juntas
}

async function migrar() {
    if (!process.argv.includes('--respaldo-confirmado')) {
        console.log('PROTECCIÓN: antes de migrar, crea y verifica un respaldo con pg_dump.');
        console.log('Ejemplo PowerShell: & \"C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe\" -U postgres -d autoscolombiadb -F c -f autoscolombiadb_antes_migracion.backup');
        console.log('Después ejecuta: npm run bd:migrar -- --respaldo-confirmado');
        process.exitCode = 1; return;
    }
    if (!await conectar()) return;
    console.log('Aplicando migraciones compatibles. No se ejecuta script_pg.sql ni se eliminan tablas...');
    try {
        await ejecutarArchivo('migracion_compatibilidad_esquema.sql');
        console.log('Migración de compatibilidad aplicada.\n');
    } catch (e) { console.log('[FALTA] La migración de compatibilidad se revirtió: ' + e.message); process.exitCode = 1; return; }
    await verificar();
}

async function crear() {
    if (!process.argv.includes('--si')) {
        console.log('ATENCIÓN: este comando BORRA las 7 tablas y todos sus datos, y las recrea con los datos de ejemplo.');
        console.log('Si de verdad quieres hacerlo, ejecuta:   npm run bd:crear -- --si');
        console.log('Si quieres conservar tus datos, usa:     npm run bd:migrar');
        process.exitCode = 1; return;
    }
    if (!await conectar()) return;
    console.log('Recreando las tablas con database/script_pg.sql ...');
    try { await ejecutarArchivo('script_pg.sql'); console.log('Tablas recreadas.\n'); }
    catch (e) { console.log('[FALTA] Falló: ' + e.message); process.exitCode = 1; return; }
    await verificar();
}

(async () => {
    const orden = process.argv[2];
    try {
        if (orden === 'verificar') await verificar();
        else if (orden === 'migrar') await migrar();
        else if (orden === 'crear') await crear();
        else { console.log('Uso: npm run bd:verificar | npm run bd:migrar | npm run bd:crear -- --si'); process.exitCode = 1; }
    } finally { await pool.end(); }
})();
