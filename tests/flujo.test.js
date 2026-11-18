process.env.AUTOSCOL_TEST_MODE = '1';
// Pruebas de integración (requieren la BD creada con database/script_pg.sql).
// Ejecutar: npm run test:it1 (usa exclusivamente DB_TEST_NAME, una base aislada terminada en _test).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { app, pool } = require('../server');
const { restaurarDatosDePrueba } = require('./ayuda');
const { hashPassword } = require('../auth');
process.env.PAGO_WEBHOOK_SECRET = 'secret-pruebas-locales';
let cookieSesion = ''; 

let servidor, base;
const fila = async (sql, params) => (await pool.query(sql, params)).rows[0];   // primera fila
const api = async (metodo, ruta, cuerpo) => {
    const headers = { 'Content-Type': 'application/json' }; if (cookieSesion) headers.Cookie = cookieSesion;
    if (ruta === '/pagos/confirmacion') headers['x-webhook-secret'] = process.env.PAGO_WEBHOOK_SECRET;
    const r = await fetch(base + ruta, { method: metodo, headers,
        body: cuerpo ? JSON.stringify(cuerpo) : undefined });
    return { status: r.status, body: await r.json() };
};

before(async () => {
    await restaurarDatosDePrueba(pool);
    await pool.query("UPDATE Usuario SET usuario_login='testadmin', password_hash=$1, tipo_usuario='Administrador', estado='Activo' WHERE documento='9999999999'", [hashPassword('Pruebas-Seguras-2026!')]);
    await new Promise(ok => { servidor = app.listen(0, ok); });
    base = `http://127.0.0.1:${servidor.address().port}/api`;
    const login = await fetch(base + '/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({usuario:'testadmin',password:'Pruebas-Seguras-2026!'}) });
    if (!login.ok) throw new Error('No se pudo iniciar sesión de prueba: ' + await login.text());
    cookieSesion = login.headers.get('set-cookie').split(';')[0];
});
after(async () => { servidor.close(); await restaurarDatosDePrueba(pool); await pool.end(); });

test('RF01 ingreso válido: asigna celda compatible automáticamente y genera ticket', async () => {
    const r = await api('POST', '/ingresos', { placa: 'abc123 ' });
    assert.equal(r.status, 201);
    assert.equal(r.body.placa, 'ABC123');
    assert.equal(r.body.celda.numero_celda, 101);
    assert.match(r.body.codigo_ticket, /^TK/);
    assert.equal(r.body.alerta, null);
    globalThis.ticketABC = r.body.codigo_ticket;
});

test('RF02 consulta el estado de la mensualidad ANTES de ingresar', async () => {
    const venc = await api('GET', '/vehiculos/XYZ987/estado');
    assert.equal(venc.body.mensualidad.estado, 'Vencida');
    assert.equal(venc.body.puede_ingresar, false);
    const dentro = await api('GET', '/vehiculos/abc123/estado');
    assert.equal(dentro.body.ingreso_activo.numero_celda, 101);
    assert.equal(dentro.body.puede_ingresar, false);
    const libre = await api('GET', '/vehiculos/MNO456/estado');
    assert.equal(libre.body.mensualidad.estado, 'Por vencer');
    assert.equal(libre.body.puede_ingresar, true);
});

test('RF01 rechaza ingreso duplicado', async () => {
    const r = await api('POST', '/ingresos', { placa: 'ABC123' });
    assert.equal(r.status, 409);
    assert.equal(r.body.codigo, 'INGRESO_DUPLICADO');
});

test('RF01 vehículo no registrado -> 404 (antes devolvía un código HTTP inválido)', async () => {
    const r = await api('POST', '/ingresos', { placa: 'ZZZ999' });
    assert.equal(r.status, 404);
    assert.equal(r.body.codigo, 'VEHICULO_NO_REGISTRADO');
});

test('RF01 placa con formato inválido -> 400', async () => {
    const r = await api('POST', '/ingresos', { placa: '12' });
    assert.equal(r.status, 400);
    assert.equal(r.body.codigo, 'PLACA_INVALIDA');
});

test('RF02 mensualidad vencida bloquea el ingreso', async () => {
    const r = await api('POST', '/ingresos', { placa: 'XYZ987' });
    assert.equal(r.status, 403);
    assert.equal(r.body.codigo, 'MENSUALIDAD_VENCIDA');
});

test('RF02 vehículo sin mensualidad bloquea el ingreso', async () => {
    const r = await api('POST', '/ingresos', { placa: 'QRS789' });
    assert.equal(r.status, 403);
    assert.equal(r.body.codigo, 'SIN_MENSUALIDAD');
});

test('RF02 mensualidad por vencer: permite ingresar pero alerta', async () => {
    const r = await api('POST', '/ingresos', { placa: 'MNO456', novedad: 'Rayón en puerta derecha' });
    assert.equal(r.status, 201);
    assert.ok(r.body.alerta.includes('vence en 3'));
    assert.equal(r.body.celda.numero_celda, 102);
    assert.ok(r.body.id_novedad);
});

test('RF06 pago: mensualidad queda pendiente hasta que el Sistema de Pago confirma', async () => {
    const crear = await api('POST', '/mensualidades', { placa: 'XYZ987', meses: 1, metodo_pago: 'PSE' });
    assert.equal(crear.status, 201);
    assert.equal(crear.body.monto, 80000);
    // renovación: empieza el día siguiente al vencimiento anterior o hoy (lo que sea posterior)
    const bloqueado = await api('POST', '/ingresos', { placa: 'XYZ987' });
    assert.equal(bloqueado.body.codigo, 'MENSUALIDAD_VENCIDA'); // aún sin pago aprobado

    const ok = await api('POST', '/pagos/confirmacion',
        { referencia_externa: crear.body.referencia_externa, estado: 'Aprobado' });
    assert.equal(ok.status, 200);
    const repetido = await api('POST', '/pagos/confirmacion',
        { referencia_externa: crear.body.referencia_externa, estado: 'Aprobado' });
    assert.equal(repetido.status, 409);

    const entra = await api('POST', '/ingresos', { placa: 'XYZ987' });
    assert.equal(entra.status, 201);
    assert.equal(entra.body.celda.numero_celda, 201); // moto -> celda de moto
});

test('RF06 pago rechazado anula la mensualidad', async () => {
    const crear = await api('POST', '/mensualidades', { placa: 'QRS789', meses: 2, metodo_pago: 'Tarjeta' });
    assert.equal(crear.body.monto, 440000);
    await api('POST', '/pagos/confirmacion', { referencia_externa: crear.body.referencia_externa, estado: 'Rechazado' });
    const m = await fila('SELECT estado_pago FROM Mensualidad WHERE id_mensualidad = $1', [crear.body.id_mensualidad]);
    assert.equal(m.estado_pago, 'Anulada');
    const r = await api('POST', '/ingresos', { placa: 'QRS789' });
    assert.equal(r.body.codigo, 'SIN_MENSUALIDAD');
});

test('RF04 sin celda compatible -> 409', async () => {
    await pool.query("UPDATE Celda SET estado = 'Mantenimiento' WHERE estado = 'Disponible' AND tipo IN ('Automovil','General')");
    const pago = await api('POST', '/mensualidades', { placa: 'QRS789', meses: 1, metodo_pago: 'PSE' });
    await api('POST', '/pagos/confirmacion', { referencia_externa: pago.body.referencia_externa, estado: 'Aprobado' });
    const r = await api('POST', '/ingresos', { placa: 'QRS789' });
    assert.equal(r.status, 409);
    assert.equal(r.body.codigo, 'SIN_CELDA_COMPATIBLE');
    await pool.query("UPDATE Celda SET estado = 'Disponible' WHERE estado = 'Mantenimiento'");
});

test('RF04 no se puede cambiar el estado de una celda ocupada', async () => {
    const c = await fila('SELECT id_celda FROM Celda WHERE numero_celda = 101');
    const r = await api('PATCH', `/celdas/${c.id_celda}/estado`, { estado: 'Mantenimiento' });
    assert.equal(r.status, 409);
    assert.equal(r.body.codigo, 'CELDA_OCUPADA');
});

test('RF05 novedad se vincula al vehículo por placa y al ingreso activo', async () => {
    const r = await api('POST', '/novedades', { placa: 'ABC123', descripcion: 'Llanta baja' });
    assert.equal(r.status, 201);
    assert.ok(r.body.id_registro);
    const lista = await api('GET', '/novedades/ABC123');
    assert.equal(lista.body.length, 1);
    const mala = await api('POST', '/novedades', { placa: 'ZZZ999', descripcion: 'x' });
    assert.equal(mala.status, 404);
});

test('RF04 dashboard resume celdas, vehículos dentro y estado de mensualidades', async () => {
    const r = await api('GET', '/dashboard');
    assert.equal(r.status, 200);
    assert.equal(r.body.celdas.total, 6);
    assert.equal(r.body.celdas.ocupadas, 3);
    assert.equal(r.body.vehiculos_en_parqueadero.length, 3);
    const estado = Object.fromEntries(r.body.mensualidades.map(m => [m.placa, m.estado]));
    assert.equal(estado.MNO456, 'Por vencer');
});

test('RF03 salida por código de ticket: libera celda y no cobra por estancia', async () => {
    const r = await api('POST', '/salidas', { codigo_ticket: globalThis.ticketABC });
    assert.equal(r.status, 200);
    assert.equal(r.body.cobro_por_estancia, 0);
    assert.ok(r.body.mensualidad_vigente_hasta);
    const c = await fila('SELECT estado FROM Celda WHERE numero_celda = 101');
    assert.equal(c.estado, 'Disponible');
});

test('RF03 salida sin ingreso activo -> 404', async () => {
    const r = await api('POST', '/salidas', { placa: 'ABC123' });
    assert.equal(r.status, 404);
    assert.equal(r.body.codigo, 'SIN_INGRESO_ACTIVO');
});

test('RF03 ticket que no corresponde a la placa -> 409', async () => {
    const reg = await fila("SELECT codigo_ticket FROM RegistroAcceso WHERE placa = 'MNO456' AND estado_acceso = 'En Parqueadero'");
    const r = await api('POST', '/salidas', { placa: 'XYZ987', codigo_ticket: reg.codigo_ticket });
    assert.equal(r.status, 409);
    assert.equal(r.body.codigo, 'TICKET_NO_COINCIDE');
});

test('RF03 salida por placa', async () => {
    const r = await api('POST', '/salidas', { placa: 'xyz987' });
    assert.equal(r.status, 200);
    assert.match(r.body.tiempo_permanencia, /min/);
});

test('Concurrencia: dos ingresos simultáneos de la misma placa -> solo uno se registra', async () => {
    await api('POST', '/salidas', { placa: 'MNO456' });
    const [a, b] = await Promise.all([
        api('POST', '/ingresos', { placa: 'MNO456' }), api('POST', '/ingresos', { placa: 'MNO456' })]);
    assert.deepEqual([a.status, b.status].sort(), [201, 409]);
});

// ============================================================================
// Pruebas añadidas en la corrección de errores (regresiones de los defectos hallados)
// ============================================================================

test('Concurrencia: tres vehículos DISTINTOS entrando a la vez no provocan deadlock (antes: 500)', async () => {
    await api('POST', '/salidas', { placa: 'MNO456' });
    for (let ronda = 1; ronda <= 15; ronda++) {
        const rs = await Promise.all(['ABC123', 'MNO456', 'QRS789'].map(placa => api('POST', '/ingresos', { placa })));
        assert.deepEqual(rs.map(r => r.status), [201, 201, 201], `ronda ${ronda}: ${JSON.stringify(rs.map(r => r.body.codigo))}`);
        assert.equal(new Set(rs.map(r => r.body.celda.numero_celda)).size, 3, 'cada vehículo debe recibir una celda distinta');
        const sal = await Promise.all(['ABC123', 'MNO456', 'QRS789'].map(placa => api('POST', '/salidas', { placa })));
        assert.deepEqual(sal.map(r => r.status), [200, 200, 200]);
    }
});

test('Concurrencia: más vehículos que celdas -> los que sobran reciben 409, nunca 500', async () => {
    await pool.query("UPDATE Celda SET estado = 'Mantenimiento' WHERE tipo IN ('Automovil','General') AND numero_celda <> 101");
    const rs = await Promise.all(['ABC123', 'MNO456', 'QRS789'].map(placa => api('POST', '/ingresos', { placa })));
    const estados = rs.map(r => r.status).sort();
    assert.deepEqual(estados, [201, 409, 409]);
    await Promise.all(['ABC123', 'MNO456', 'QRS789'].map(placa => api('POST', '/salidas', { placa })));
    await pool.query("UPDATE Celda SET estado = 'Disponible' WHERE estado = 'Mantenimiento'");
});

test('Errores de formato: JSON inválido -> 400 en JSON (antes: HTML con traza interna)', async () => {
    const r = await fetch(base + '/ingresos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"placa":' });
    assert.equal(r.status, 400);
    assert.match(r.headers.get('content-type'), /json/);
    const cuerpo = await r.json();
    assert.equal(cuerpo.codigo, 'JSON_INVALIDO');
    assert.ok(!JSON.stringify(cuerpo).includes('node_modules'), 'no debe filtrar rutas internas');
});

test('Errores de formato: ruta /api inexistente -> 404 en JSON', async () => {
    const r = await api('GET', '/no-existe');
    assert.equal(r.status, 404);
    assert.equal(r.body.codigo, 'RUTA_NO_ENCONTRADA');
});

test('Errores de formato: cuerpo gigante -> 413 (antes: aceptaba hasta 100 KB)', async () => {
    const r = await api('POST', '/novedades', { placa: 'ABC123', descripcion: 'x'.repeat(40000) });
    assert.equal(r.status, 413);
    assert.equal(r.body.codigo, 'CUERPO_MUY_GRANDE');
});

test('RF04 id de celda no numérico -> 400 (antes: 500)', async () => {
    const r = await api('PATCH', '/celdas/abc/estado', { estado: 'Mantenimiento' });
    assert.equal(r.status, 400);
    assert.equal(r.body.codigo, 'ID_INVALIDO');
    const neg = await api('PATCH', '/celdas/0/estado', { estado: 'Mantenimiento' });
    assert.equal(neg.status, 400);
});

test('RF05 descripción de novedad demasiado larga -> 400 (antes: 500 por columna TEXT)', async () => {
    const r = await api('POST', '/novedades', { placa: 'ABC123', descripcion: 'x'.repeat(501) });
    assert.equal(r.status, 400);
    assert.equal(r.body.codigo, 'DESCRIPCION_MUY_LARGA');
    const ingreso = await api('POST', '/ingresos', { placa: 'ABC123', novedad: 'x'.repeat(501) });
    assert.equal(ingreso.body.codigo, 'DESCRIPCION_MUY_LARGA');
    const a = await fila("SELECT COUNT(*)::int AS n FROM RegistroAcceso WHERE placa = 'ABC123' AND estado_acceso = 'En Parqueadero'");
    assert.equal(a.n, 0, 'un ingreso rechazado no debe dejar registros');
});

test('Placa: acepta guion y espacios internos (ABC-123, "abc 123")', async () => {
    const a = await api('GET', '/vehiculos/ABC-123/estado');
    assert.equal(a.status, 200);
    assert.equal(a.body.placa, 'ABC123');
    const b = await api('GET', '/vehiculos/' + encodeURIComponent('abc 123') + '/estado');
    assert.equal(b.body.placa, 'ABC123');
});

test('RF06 un solo pago pendiente por placa: no se apilan mensualidades sin pagar', async () => {
    const primero = await api('POST', '/mensualidades', { placa: 'XYZ987', meses: 1, metodo_pago: 'PSE' });
    assert.equal(primero.status, 201);
    const segundo = await api('POST', '/mensualidades', { placa: 'XYZ987', meses: 1, metodo_pago: 'PSE' });
    assert.equal(segundo.status, 409);
    assert.equal(segundo.body.codigo, 'PAGO_PENDIENTE');
    assert.equal(segundo.body.referencia_externa, primero.body.referencia_externa);
    globalThis.refPendiente = primero.body.referencia_externa;
    globalThis.mensPendiente = primero.body.id_mensualidad;
});

test('RF06 un pago pendiente que expira se anula y permite generar uno nuevo', async () => {
    await pool.query("UPDATE Pago SET fecha_pago = LOCALTIMESTAMP(0) - INTERVAL '2 days' WHERE referencia_externa = $1", [globalThis.refPendiente]);
    const nuevo = await api('POST', '/mensualidades', { placa: 'XYZ987', meses: 1, metodo_pago: 'Tarjeta' });
    assert.equal(nuevo.status, 201);
    const viejo = await fila(
        'SELECT m.estado_pago AS m, p.estado_pago AS p FROM Mensualidad m JOIN Pago p USING (id_mensualidad) WHERE m.id_mensualidad = $1',
        [globalThis.mensPendiente]);
    assert.deepEqual(viejo, { m: 'Anulada', p: 'Rechazado' });
    // el pago expirado ya no puede confirmarse
    const tarde = await api('POST', '/pagos/confirmacion', { referencia_externa: globalThis.refPendiente, estado: 'Aprobado' });
    assert.equal(tarde.status, 409);
    globalThis.refNueva = nuevo.body.referencia_externa;
});

test('RF06 la renovación encadena desde la última mensualidad PAGADA (ni antes ni después)', async () => {
    const r = await fila(
        `SELECT p.fecha_inicio AS inicio_pendiente,
                (SELECT MAX(fecha_fin) FROM Mensualidad WHERE placa = 'XYZ987' AND estado_pago = 'Pagada') + 1 AS esperado
         FROM Mensualidad p WHERE p.placa = 'XYZ987' AND p.estado_pago = 'Pendiente'`);
    assert.equal(r.inicio_pendiente, r.esperado);
    await api('POST', '/pagos/confirmacion', { referencia_externa: globalThis.refNueva, estado: 'Rechazado' });
});

test('RF06 meses booleano o inválido -> 400', async () => {
    const r = await api('POST', '/mensualidades', { placa: 'ABC123', meses: true, metodo_pago: 'PSE' });
    assert.equal(r.status, 400);
    assert.equal(r.body.codigo, 'MESES_INVALIDOS');
});

test('Seguridad: con PAGO_WEBHOOK_SECRET definido, el callback exige el secreto', async () => {
    const crear = await api('POST', '/mensualidades', { placa: 'ABC123', meses: 1, metodo_pago: 'PSE' });
    assert.equal(crear.status, 201);
    const cuerpo = JSON.stringify({ referencia_externa: crear.body.referencia_externa, estado: 'Aprobado' });
    const llamar = (cabeceras) => fetch(base + '/pagos/confirmacion',
        { method: 'POST', headers: { 'Content-Type': 'application/json', ...cabeceras }, body: cuerpo });
    process.env.PAGO_WEBHOOK_SECRET = 's3creto-de-prueba';
    try {
        assert.equal((await llamar({})).status, 401, 'sin secreto');
        assert.equal((await llamar({ 'x-webhook-secret': 'incorrecto' })).status, 401, 'secreto incorrecto');
        assert.equal((await llamar({ 'x-webhook-secret': 's3creto-de-prueba' })).status, 200, 'secreto correcto');
    } finally { delete process.env.PAGO_WEBHOOK_SECRET; }
});

test('Salud: /api/health responde 200 cuando la BD está disponible', async () => {
    const r = await api('GET', '/health');
    assert.equal(r.status, 200);
    assert.equal(r.body.estado, 'ok');
});
