process.env.AUTOSCOL_TEST_MODE = '1';
// Pruebas de integración de la ITERACIÓN 2: gestión de usuarios y gestión de celdas.
// Requieren la BD creada con database/script_pg.sql.
// Ejecutar: npm run test:it2 (usa exclusivamente DB_TEST_NAME, una base aislada terminada en _test).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { app, pool } = require('../server');
const { restaurarDatosDePrueba } = require('./ayuda');
const { hashPassword } = require('../auth');
process.env.PAGO_WEBHOOK_SECRET = 'secret-pruebas-locales';
let cookieSesion = ''; 

let servidor, base;
const fila = async (sql, params) => (await pool.query(sql, params)).rows[0];
const api = async (metodo, ruta, cuerpo) => {
    const headers = { 'Content-Type': 'application/json' }; if (cookieSesion) headers.Cookie = cookieSesion;
    if (ruta === '/pagos/confirmacion') headers['x-webhook-secret'] = process.env.PAGO_WEBHOOK_SECRET;
    const r = await fetch(base + ruta, { method: metodo, headers,
        body: cuerpo ? JSON.stringify(cuerpo) : undefined });
    return { status: r.status, body: await r.json() };
};
const usuarioPorDoc = (doc) => fila('SELECT * FROM Usuario WHERE documento = $1', [doc]);
const ingresar = (placa) => api('POST', '/ingresos', { placa });
const salir = (placa) => api('POST', '/salidas', { placa });
const CARLOS = '1017123456', MARTA = '1030555111', PEDRO = '1030555222', ADMIN = '9999999999';
const ids = {}; // identificadores creados durante las pruebas

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

// ============================================================ GESTIÓN DE USUARIOS
test('RF07 registrar usuario válido: normaliza los datos y nace Activo/Cliente', async () => {
    const r = await api('POST', '/usuarios', { nombre: '  Juan   Pérez ', documento: '1.234.567-8',
        telefono: '300 123-4567', correo: 'JUAN@Email.COM' });
    assert.equal(r.status, 201);
    assert.deepEqual(
        { n: r.body.usuario.nombre, d: r.body.usuario.documento, t: r.body.usuario.telefono, c: r.body.usuario.correo,
          tipo: r.body.usuario.tipo_usuario, e: r.body.usuario.estado },
        { n: 'Juan Pérez', d: '12345678', t: '3001234567', c: 'juan@email.com', tipo: 'Cliente', e: 'Activo' });
    ids.juan = r.body.usuario.id_usuario;
    assert.ok(Number.isInteger(ids.juan));
});

test('RF07 datos inválidos -> 400 con el detalle de CADA campo erróneo', async () => {
    const r = await api('POST', '/usuarios', { nombre: 'Al', documento: '12', telefono: '123',
        correo: 'no-es-correo', tipo_usuario: 'Jefe' });
    assert.equal(r.status, 400);
    assert.equal(r.body.codigo, 'DATOS_INVALIDOS');
    assert.deepEqual(Object.keys(r.body.campos).sort(), ['correo', 'documento', 'nombre', 'telefono', 'tipo_usuario']);
    const vacio = await api('POST', '/usuarios', {});
    assert.equal(vacio.status, 400);
    assert.deepEqual(Object.keys(vacio.body.campos).sort(), ['documento', 'nombre']);
});

test('RF07 documento duplicado -> 409 (aunque venga con otro formato)', async () => {
    const a = await api('POST', '/usuarios', { nombre: 'Otra Persona', documento: '12345678' });
    assert.equal(a.status, 409);
    assert.equal(a.body.codigo, 'DOCUMENTO_DUPLICADO');
    const b = await api('POST', '/usuarios', { nombre: 'Otra Persona', documento: '1.234.567-8' });
    assert.equal(b.body.codigo, 'DOCUMENTO_DUPLICADO');
});

test('Concurrencia: dos registros simultáneos con el mismo documento -> uno 201 y uno 409, nunca 500', async () => {
    const rs = await Promise.all(['Persona Doble Uno', 'Persona Doble Dos'].map(nombre => api('POST', '/usuarios', { nombre, documento: '55555551' })));
    assert.deepEqual(rs.map(r => r.status).sort(), [201, 409]);
    assert.equal(rs.find(r => r.status === 409).body.codigo, 'DOCUMENTO_DUPLICADO');
});

test('RF08 listar usuarios: total, paginación y cantidad de vehículos', async () => {
    const r = await api('GET', '/usuarios');
    assert.equal(r.status, 200);
    assert.ok(r.body.total >= 8 && r.body.usuarios.length === r.body.total);
    const carlos = r.body.usuarios.find(u => u.documento === CARLOS);
    assert.equal(carlos.total_vehiculos, 2);
    const nombres = r.body.usuarios.map(u => u.nombre);
    assert.deepEqual(nombres, [...nombres].sort((a, b) => a.localeCompare(b, 'es')), 'ordenados por nombre');
    const p = await api('GET', '/usuarios?limite=2&pagina=2');
    assert.equal(p.body.usuarios.length, 2);
    assert.equal(p.body.pagina, 2);
    assert.equal(p.body.total, r.body.total);
});

test('RF08 buscar y filtrar: por nombre, documento, placa, tipo y estado; los comodines se buscan literal', async () => {
    const docs = async (q) => (await api('GET', '/usuarios?' + q)).body.usuarios.map(u => u.documento);
    assert.deepEqual(await docs('buscar=carlos'), [CARLOS]);
    assert.deepEqual(await docs('buscar=abc123'), [CARLOS], 'por placa de uno de sus vehículos');
    assert.deepEqual((await docs('buscar=1030555')).sort(), [MARTA, PEDRO].sort());
    assert.deepEqual(await docs('tipo=Administrador'), [ADMIN]);
    const inactivos = await docs('estado=Inactivo');
    assert.ok(inactivos.includes(PEDRO) && !inactivos.includes(MARTA));
    assert.deepEqual(await docs('buscar=' + encodeURIComponent('%')), [], '"%" no es comodín');
    assert.deepEqual(await docs('buscar=' + encodeURIComponent('p_rez')), [], '"_" no es comodín');
});

test('RF08 filtros y paginación inválidos -> 400', async () => {
    assert.equal((await api('GET', '/usuarios?tipo=Jefe')).body.codigo, 'FILTRO_INVALIDO');
    assert.equal((await api('GET', '/usuarios?estado=Borrado')).body.codigo, 'FILTRO_INVALIDO');
    assert.equal((await api('GET', '/usuarios?limite=0')).body.codigo, 'PAGINACION_INVALIDA');
    assert.equal((await api('GET', '/usuarios?pagina=abc')).body.codigo, 'PAGINACION_INVALIDA');
});

test('RF09 detalle del usuario: vehículos con el estado de su mensualidad', async () => {
    const carlos = await usuarioPorDoc(CARLOS);
    const r = await api('GET', '/usuarios/' + carlos.id_usuario);
    assert.equal(r.status, 200);
    assert.equal(r.body.usuario.nombre, 'Carlos Pérez');
    const porPlaca = Object.fromEntries(r.body.vehiculos.map(v => [v.placa, v]));
    assert.deepEqual(Object.keys(porPlaca).sort(), ['ABC123', 'QRS789']);
    assert.equal(porPlaca.ABC123.mensualidad.estado, 'Vigente');
    assert.equal(porPlaca.QRS789.mensualidad.estado, 'Sin mensualidad');
    assert.equal(porPlaca.ABC123.dentro_del_parqueadero, false);
    assert.equal((await api('GET', '/usuarios/999999')).status, 404);
    assert.equal((await api('GET', '/usuarios/abc')).body.codigo, 'ID_INVALIDO');
});

test('RF10 actualizar usuario: cambios parciales, campos opcionales vacíos y errores', async () => {
    const a = await api('PUT', '/usuarios/' + ids.juan, { nombre: 'Juan Carlos Pérez', telefono: '', correo: '' });
    assert.equal(a.status, 200);
    assert.equal(a.body.usuario.nombre, 'Juan Carlos Pérez');
    assert.equal(a.body.usuario.telefono, null);
    assert.equal(a.body.usuario.correo, null);
    const b = await api('PUT', '/usuarios/' + ids.juan, { telefono: '3109998888' });
    assert.equal(b.body.usuario.telefono, '3109998888');
    assert.equal(b.body.usuario.nombre, 'Juan Carlos Pérez', 'los campos no enviados no cambian');
    assert.equal((await api('PUT', '/usuarios/' + ids.juan, { documento: CARLOS })).body.codigo, 'DOCUMENTO_DUPLICADO');
    assert.equal((await api('PUT', '/usuarios/' + ids.juan, {})).body.codigo, 'DATOS_INCOMPLETOS');
    assert.equal((await api('PUT', '/usuarios/' + ids.juan, { correo: 'malo' })).body.codigo, 'DATOS_INVALIDOS');
    assert.equal((await api('PUT', '/usuarios/999999', { nombre: 'Nadie Existe' })).status, 404);
    const mismo = await api('PUT', '/usuarios/' + ids.juan, { documento: '12345678' });
    assert.equal(mismo.status, 200, 'dejar su propio documento no es duplicado');
});

test('RF10 un usuario con vehículos no puede dejar de ser Cliente', async () => {
    const carlos = await usuarioPorDoc(CARLOS);
    const r = await api('PUT', '/usuarios/' + carlos.id_usuario, { tipo_usuario: 'Operario' });
    assert.equal(r.status, 409);
    assert.equal(r.body.codigo, 'USUARIO_CON_VEHICULOS');
    const juan = await api('PUT', '/usuarios/' + ids.juan, { tipo_usuario: 'Operario' });
    assert.equal(juan.status, 200, 'sin vehículos sí puede cambiar');
    await api('PUT', '/usuarios/' + ids.juan, { tipo_usuario: 'Cliente' });
});

test('RF11 inactivar y reactivar un usuario (baja lógica, idempotente)', async () => {
    const a = await api('PATCH', `/usuarios/${ids.juan}/estado`, { estado: 'Inactivo' });
    assert.equal(a.status, 200);
    assert.equal(a.body.estado, 'Inactivo');
    assert.match((await api('PATCH', `/usuarios/${ids.juan}/estado`, { estado: 'Inactivo' })).body.mensaje, /ya estaba inactivo/);
    assert.equal((await fila('SELECT estado FROM Usuario WHERE id_usuario = $1', [ids.juan])).estado, 'Inactivo');
    const b = await api('PATCH', `/usuarios/${ids.juan}/estado`, { estado: 'Activo' });
    assert.equal(b.body.estado, 'Activo');
    assert.equal((await api('PATCH', `/usuarios/${ids.juan}/estado`, { estado: 'Borrado' })).body.codigo, 'ESTADO_INVALIDO');
    assert.equal((await api('PATCH', '/usuarios/999999/estado', { estado: 'Inactivo' })).status, 404);
});

test('RF11 no se puede inactivar a un usuario con un vehículo dentro del parqueadero', async () => {
    const carlos = await usuarioPorDoc(CARLOS);
    assert.equal((await ingresar('ABC123')).status, 201);
    try {
        const r = await api('PATCH', `/usuarios/${carlos.id_usuario}/estado`, { estado: 'Inactivo' });
        assert.equal(r.status, 409);
        assert.equal(r.body.codigo, 'USUARIO_CON_VEHICULO_DENTRO');
        assert.deepEqual(r.body.placas, ['ABC123']);
    } finally { await salir('ABC123'); }
    assert.equal((await api('PATCH', `/usuarios/${carlos.id_usuario}/estado`, { estado: 'Inactivo' })).status, 200);
    await api('PATCH', `/usuarios/${carlos.id_usuario}/estado`, { estado: 'Activo' });
});

test('Integración RF01: los vehículos de un usuario inactivo no pueden ingresar', async () => {
    const carlos = await usuarioPorDoc(CARLOS);
    await api('PATCH', `/usuarios/${carlos.id_usuario}/estado`, { estado: 'Inactivo' });
    try {
        const r = await ingresar('ABC123');
        assert.equal(r.status, 403);
        assert.equal(r.body.codigo, 'USUARIO_INACTIVO');
        const previo = await api('GET', '/vehiculos/ABC123/estado');
        assert.equal(previo.body.puede_ingresar, false);
        assert.match(previo.body.motivo, /inactivo/);
        assert.equal(previo.body.propietario.estado, 'Inactivo');
    } finally { await api('PATCH', `/usuarios/${carlos.id_usuario}/estado`, { estado: 'Activo' }); }
    assert.equal((await ingresar('ABC123')).status, 201, 'reactivado, vuelve a poder ingresar');
    await salir('ABC123');
});

test('RF12 registrar vehículo a un usuario (placa normalizada)', async () => {
    const r = await api('POST', `/usuarios/${ids.juan}/vehiculos`,
        { placa: 'jkl-456', marca: 'Renault', modelo: 'Logan', color: 'Azul', tipo: 'Automovil' });
    assert.equal(r.status, 201);
    assert.equal(r.body.vehiculo.placa, 'JKL456');
    assert.equal(r.body.vehiculo.id_usuario, ids.juan);
    const det = await api('GET', '/usuarios/' + ids.juan);
    assert.deepEqual(det.body.vehiculos.map(v => v.placa), ['JKL456']);
});

test('RF12 errores al registrar vehículo: duplicada, inválida, tipo, usuario inactivo / no Cliente / inexistente', async () => {
    const url = (id) => `/usuarios/${id}/vehiculos`;
    const pedro = await usuarioPorDoc(PEDRO), admin = await usuarioPorDoc(ADMIN);
    assert.equal((await api('POST', url(ids.juan), { placa: 'JKL456', tipo: 'Automovil' })).body.codigo, 'PLACA_DUPLICADA');
    assert.equal((await api('POST', url(ids.juan), { placa: 'abc-123', tipo: 'Automovil' })).body.codigo, 'PLACA_DUPLICADA', 'otra forma de escribir una placa existente');
    assert.equal((await api('POST', url(ids.juan), { placa: 'AB12', tipo: 'Automovil' })).body.codigo, 'PLACA_INVALIDA');
    const tipo = await api('POST', url(ids.juan), { placa: 'AAA111', tipo: 'Bus' });
    assert.equal(tipo.body.codigo, 'DATOS_INVALIDOS');
    assert.ok(tipo.body.campos.tipo);
    assert.equal((await api('POST', url(pedro.id_usuario), { placa: 'AAA111', tipo: 'Automovil' })).body.codigo, 'USUARIO_INACTIVO');
    assert.equal((await api('POST', url(admin.id_usuario), { placa: 'AAA111', tipo: 'Automovil' })).body.codigo, 'TIPO_USUARIO_SIN_VEHICULOS');
    assert.equal((await api('POST', url(999999), { placa: 'AAA111', tipo: 'Automovil' })).status, 404);
    assert.equal((await fila("SELECT COUNT(*)::int AS n FROM Vehiculo WHERE placa = 'AAA111'")).n, 0, 'ningún intento fallido dejó datos');
});

test('Concurrencia: la misma placa registrada a dos usuarios a la vez -> uno 201 y uno 409', async () => {
    const marta = await usuarioPorDoc(MARTA);
    const rs = await Promise.all([ids.juan, marta.id_usuario].map(id =>
        api('POST', `/usuarios/${id}/vehiculos`, { placa: 'DDD444', tipo: 'Motocicleta' })));
    assert.deepEqual(rs.map(r => r.status).sort(), [201, 409]);
    assert.equal(rs.find(r => r.status === 409).body.codigo, 'PLACA_DUPLICADA');
    await pool.query("DELETE FROM Vehiculo WHERE placa = 'DDD444'");
});

test('RF13 actualizar vehículo: datos, tipo y propietario', async () => {
    const marta = await usuarioPorDoc(MARTA), pedro = await usuarioPorDoc(PEDRO), admin = await usuarioPorDoc(ADMIN);
    const a = await api('PUT', '/vehiculos/jkl-456', { color: 'Verde', marca: 'Renault Sandero' });
    assert.equal(a.status, 200);
    assert.deepEqual({ c: a.body.vehiculo.color, m: a.body.vehiculo.marca, mo: a.body.vehiculo.modelo },
        { c: 'Verde', m: 'Renault Sandero', mo: 'Logan' });
    assert.equal((await api('PUT', '/vehiculos/JKL456', { tipo: 'Camioneta' })).body.vehiculo.tipo, 'Camioneta');
    assert.equal((await api('PUT', '/vehiculos/JKL456', { tipo: 'Bus' })).body.codigo, 'DATOS_INVALIDOS');
    assert.equal((await api('PUT', '/vehiculos/JKL456', { id_usuario: pedro.id_usuario })).body.codigo, 'PROPIETARIO_NO_VALIDO', 'inactivo');
    assert.equal((await api('PUT', '/vehiculos/JKL456', { id_usuario: admin.id_usuario })).body.codigo, 'PROPIETARIO_NO_VALIDO', 'no Cliente');
    const dueno = await api('PUT', '/vehiculos/JKL456', { id_usuario: marta.id_usuario });
    assert.equal(dueno.body.vehiculo.id_usuario, marta.id_usuario);
    assert.equal((await api('PUT', '/vehiculos/JKL456', {})).body.codigo, 'DATOS_INCOMPLETOS');
    assert.equal((await api('PUT', '/vehiculos/ZZZ999', { color: 'Rojo' })).status, 404);
    assert.equal((await api('PUT', '/vehiculos/AB1', { color: 'Rojo' })).body.codigo, 'PLACA_INVALIDA');
});

test('RF13 no se cambia el tipo ni el propietario de un vehículo que está dentro', async () => {
    const marta = await usuarioPorDoc(MARTA);
    assert.equal((await ingresar('ABC123')).status, 201);
    try {
        assert.equal((await api('PUT', '/vehiculos/ABC123', { tipo: 'Camioneta' })).body.codigo, 'VEHICULO_DENTRO');
        assert.equal((await api('PUT', '/vehiculos/ABC123', { id_usuario: marta.id_usuario })).body.codigo, 'VEHICULO_DENTRO');
        assert.equal((await api('PUT', '/vehiculos/ABC123', { color: 'Negro' })).status, 200, 'datos que no afectan la celda sí');
        await api('PUT', '/vehiculos/ABC123', { color: 'Rojo' });
    } finally { await salir('ABC123'); }
});

test('Integración RF01-RF06: un vehículo registrado por la API queda listo para operar', async () => {
    assert.equal((await ingresar('JKL456')).body.codigo, 'SIN_MENSUALIDAD');
    const m = await api('POST', '/mensualidades', { placa: 'JKL456', meses: 1, metodo_pago: 'PSE' });
    assert.equal(m.status, 201);
    assert.equal((await api('POST', '/pagos/confirmacion', { referencia_externa: m.body.referencia_externa, estado: 'Aprobado' })).status, 200);
    const ing = await ingresar('JKL456');
    assert.equal(ing.status, 201);
    assert.equal((await salir('JKL456')).status, 200);
});

test('Concurrencia: inactivar al propietario e ingresar su vehículo a la vez nunca deja un inactivo con vehículo dentro', async () => {
    const carlos = await usuarioPorDoc(CARLOS);
    const resultados = new Set();
    for (let ronda = 1; ronda <= 12; ronda++) {
        const [inact, ing] = await Promise.all([
            api('PATCH', `/usuarios/${carlos.id_usuario}/estado`, { estado: 'Inactivo' }),
            ingresar('ABC123')]);
        const par = `${inact.status}/${ing.status}`;
        resultados.add(par);
        assert.ok(['200/403', '409/201'].includes(par), `ronda ${ronda}: combinación imposible ${par}`);
        const dentro = (await fila("SELECT COUNT(*)::int AS n FROM RegistroAcceso WHERE placa = 'ABC123' AND estado_acceso = 'En Parqueadero'")).n;
        const estado = (await fila('SELECT estado FROM Usuario WHERE id_usuario = $1', [carlos.id_usuario])).estado;
        assert.ok(!(estado === 'Inactivo' && dentro === 1), `ronda ${ronda}: inactivo con vehículo dentro`);
        if (dentro) await salir('ABC123');
        await api('PATCH', `/usuarios/${carlos.id_usuario}/estado`, { estado: 'Activo' });
    }
});

// ============================================================ GESTIÓN DE CELDAS
test('RF14 consultar celdas con filtros por estado y tipo', async () => {
    const todas = await api('GET', '/celdas');
    assert.equal(todas.status, 200);
    assert.ok(Array.isArray(todas.body) && todas.body.length >= 6);
    const motos = await api('GET', '/celdas?tipo=Motocicleta');
    assert.deepEqual(motos.body.map(c => c.numero_celda), [201, 202]);
    const libres = await api('GET', '/celdas?estado=Disponible&tipo=General');
    assert.deepEqual(libres.body.map(c => c.numero_celda), [301]);
    assert.equal((await api('GET', '/celdas?estado=Roto')).body.codigo, 'FILTRO_INVALIDO');
    assert.equal((await api('GET', '/celdas?tipo=Barco')).body.codigo, 'FILTRO_INVALIDO');
});

test('RF16 registrar celda: nace Disponible, tipo General por defecto, número como texto aceptado', async () => {
    const a = await api('POST', '/celdas', { numero_celda: 401, tipo: 'Automovil' });
    assert.equal(a.status, 201);
    assert.deepEqual({ n: a.body.celda.numero_celda, e: a.body.celda.estado, t: a.body.celda.tipo },
        { n: 401, e: 'Disponible', t: 'Automovil' });
    ids.celda401 = a.body.celda.id_celda;
    const b = await api('POST', '/celdas', { numero_celda: 402 });
    assert.equal(b.body.celda.tipo, 'General');
    ids.celda402 = b.body.celda.id_celda;
    const c = await api('POST', '/celdas', { numero_celda: '403', tipo: 'Motocicleta' });
    assert.equal(c.body.celda.numero_celda, 403);
});

test('RF16 celda duplicada o datos inválidos -> 409 / 400', async () => {
    assert.equal((await api('POST', '/celdas', { numero_celda: 401 })).body.codigo, 'CELDA_DUPLICADA');
    assert.equal((await api('POST', '/celdas', { numero_celda: 101 })).body.codigo, 'CELDA_DUPLICADA', 'también contra las celdas de ejemplo');
    for (const numero_celda of [0, 10000, 'abc', 1.5, -4, null, undefined]) {
        const r = await api('POST', '/celdas', { numero_celda });
        assert.equal(r.status, 400, `numero_celda=${numero_celda}`);
        assert.ok(r.body.campos.numero_celda);
    }
    const tipo = await api('POST', '/celdas', { numero_celda: 499, tipo: 'Barco' });
    assert.equal(tipo.body.codigo, 'DATOS_INVALIDOS');
    assert.equal((await fila('SELECT COUNT(*)::int AS n FROM Celda WHERE numero_celda = 499')).n, 0);
});

test('Concurrencia: dos celdas con el mismo número a la vez -> uno 201 y uno 409', async () => {
    const rs = await Promise.all([1, 2].map(() => api('POST', '/celdas', { numero_celda: 404, tipo: 'General' })));
    assert.deepEqual(rs.map(r => r.status).sort(), [201, 409]);
    assert.equal(rs.find(r => r.status === 409).body.codigo, 'CELDA_DUPLICADA');
    await pool.query('DELETE FROM Celda WHERE numero_celda = 404');
});

test('RF15 detalle de una celda: libre, ocupada (quién la ocupa) y errores', async () => {
    const libre = await api('GET', '/celdas/' + ids.celda401);
    assert.equal(libre.status, 200);
    assert.equal(libre.body.ocupacion_actual, null);
    assert.equal(libre.body.total_usos, 0);
    const ing = await ingresar('ABC123');
    try {
        const c101 = await fila('SELECT id_celda FROM Celda WHERE numero_celda = 101');
        const ocupada = await api('GET', '/celdas/' + c101.id_celda);
        assert.equal(ocupada.body.celda.estado, 'Ocupada');
        assert.equal(ocupada.body.ocupacion_actual.placa, 'ABC123');
        assert.equal(ocupada.body.ocupacion_actual.codigo_ticket, ing.body.codigo_ticket);
        const usos = (await fila('SELECT COUNT(*)::int AS n FROM RegistroAcceso WHERE id_celda = $1', [c101.id_celda])).n;
        assert.ok(usos >= 1);
        assert.equal(ocupada.body.total_usos, usos, 'cuenta todos los ingresos que ha tenido la celda');
    } finally { await salir('ABC123'); }
    assert.equal((await api('GET', '/celdas/999999')).status, 404);
    assert.equal((await api('GET', '/celdas/abc')).body.codigo, 'ID_INVALIDO');
});

test('RF17 editar celda: tipo, número, duplicados, sin campos y celda ocupada', async () => {
    const a = await api('PUT', '/celdas/' + ids.celda401, { tipo: 'General' });
    assert.equal(a.status, 200);
    assert.equal(a.body.celda.tipo, 'General');
    assert.equal(a.body.celda.numero_celda, 401, 'lo que no se envía no cambia');
    const b = await api('PUT', '/celdas/' + ids.celda401, { numero_celda: 405 });
    assert.equal(b.body.celda.numero_celda, 405);
    assert.equal((await api('PUT', '/celdas/' + ids.celda401, { numero_celda: 101 })).body.codigo, 'CELDA_DUPLICADA');
    assert.equal((await api('PUT', '/celdas/' + ids.celda401, { numero_celda: 405 })).status, 200, 'conservar su propio número no es duplicado');
    assert.equal((await api('PUT', '/celdas/' + ids.celda401, {})).body.codigo, 'DATOS_INCOMPLETOS');
    assert.equal((await api('PUT', '/celdas/' + ids.celda401, { tipo: 'X' })).body.codigo, 'DATOS_INVALIDOS');
    assert.equal((await api('PUT', '/celdas/999999', { tipo: 'General' })).status, 404);
    await api('PUT', '/celdas/' + ids.celda401, { numero_celda: 401, tipo: 'Automovil' });
    assert.equal((await ingresar('ABC123')).status, 201);
    try {
        const c101 = await fila('SELECT id_celda FROM Celda WHERE numero_celda = 101');
        const r = await api('PUT', '/celdas/' + c101.id_celda, { tipo: 'General' });
        assert.equal(r.status, 409);
        assert.equal(r.body.codigo, 'CELDA_OCUPADA');
    } finally { await salir('ABC123'); }
});

test('RF18 cambiar estado de una celda: Mantenimiento <-> Disponible y errores', async () => {
    const a = await api('PATCH', `/celdas/${ids.celda402}/estado`, { estado: 'Mantenimiento' });
    assert.equal(a.status, 200);
    assert.equal((await fila('SELECT estado FROM Celda WHERE id_celda = $1', [ids.celda402])).estado, 'Mantenimiento');
    assert.equal((await api('PATCH', `/celdas/${ids.celda402}/estado`, { estado: 'Disponible' })).body.estado, 'Disponible');
    assert.equal((await api('PATCH', `/celdas/${ids.celda402}/estado`, { estado: 'Ocupada' })).body.codigo, 'ESTADO_INVALIDO');
    assert.equal((await api('PATCH', '/celdas/999999/estado', { estado: 'Disponible' })).status, 404);
    assert.equal((await api('PATCH', '/celdas/abc/estado', { estado: 'Disponible' })).body.codigo, 'ID_INVALIDO');
});

test('RF19 eliminar celda: solo si nunca se usó y no está ocupada', async () => {
    const nueva = await api('POST', '/celdas', { numero_celda: 450, tipo: 'General' });
    const borrar = await api('DELETE', '/celdas/' + nueva.body.celda.id_celda);
    assert.equal(borrar.status, 200);
    assert.equal(borrar.body.numero_celda, 450);
    assert.equal((await api('GET', '/celdas/' + nueva.body.celda.id_celda)).status, 404);
    const c101 = await fila('SELECT id_celda FROM Celda WHERE numero_celda = 101');
    // 101 ya fue usada en pruebas anteriores -> tiene historial
    const conHistorial = await api('DELETE', '/celdas/' + c101.id_celda);
    assert.equal(conHistorial.status, 409);
    assert.equal(conHistorial.body.codigo, 'CELDA_CON_HISTORIAL');
    assert.equal((await fila('SELECT COUNT(*)::int AS n FROM Celda WHERE numero_celda = 101')).n, 1, 'no se borró');
    // ocupada
    assert.equal((await ingresar('ABC123')).status, 201);
    try {
        const ocupada = await api('DELETE', '/celdas/' + c101.id_celda);
        assert.equal(ocupada.body.codigo, 'CELDA_OCUPADA');
    } finally { await salir('ABC123'); }
    assert.equal((await api('DELETE', '/celdas/999999')).status, 404);
    assert.equal((await api('DELETE', '/celdas/abc')).body.codigo, 'ID_INVALIDO');
});

test('Integración RF01: una celda nueva se asigna sola; en Mantenimiento o de otro tipo no se asigna', async () => {
    // Deja solo la celda 401 (Automovil) como opción para un automóvil
    await pool.query("UPDATE Celda SET estado = 'Mantenimiento' WHERE numero_celda <> 401");
    const ing = await ingresar('ABC123');
    assert.equal(ing.status, 201);
    assert.equal(ing.body.celda.numero_celda, 401, 'usa la celda creada por la API');
    await salir('ABC123');
    // Misma celda pero de tipo Motocicleta: ya no sirve para un automóvil
    await api('PUT', '/celdas/' + ids.celda401, { tipo: 'Motocicleta' });
    assert.equal((await ingresar('ABC123')).body.codigo, 'SIN_CELDA_COMPATIBLE');
    // De vuelta a Automovil pero en Mantenimiento: tampoco se asigna
    await api('PUT', '/celdas/' + ids.celda401, { tipo: 'Automovil' });
    await api('PATCH', `/celdas/${ids.celda401}/estado`, { estado: 'Mantenimiento' });
    assert.equal((await ingresar('ABC123')).body.codigo, 'SIN_CELDA_COMPATIBLE');
    // Disponible otra vez: se asigna
    await api('PATCH', `/celdas/${ids.celda401}/estado`, { estado: 'Disponible' });
    assert.equal((await ingresar('ABC123')).status, 201);
    await salir('ABC123');
    await pool.query("UPDATE Celda SET estado = 'Disponible'");
});

test('Seguridad: asignar credenciales e invalidar inmediatamente una sesión al inactivar la cuenta', async () => {
    assert.ok(ids.juan, 'Juan debe existir por las pruebas anteriores');
    const asignacion = await api('PATCH', `/usuarios/${ids.juan}/credenciales`, {
        usuario_login: 'juan_prueba',
        password: 'Clave-Juan-Pruebas-2026!'
    });
    assert.equal(asignacion.status, 200);
    assert.equal(asignacion.body.usuario.usuario_login, 'juan_prueba');
    assert.equal(JSON.stringify(asignacion.body).includes('password_hash'), false);

    const login = await fetch(base + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario: 'juan_prueba', password: 'Clave-Juan-Pruebas-2026!' })
    });
    assert.equal(login.status, 200);
    const cookieJuan = login.headers.get('set-cookie').split(';')[0];

    try {
        const antes = await fetch(base + '/auth/me', { headers: { Cookie: cookieJuan } });
        assert.equal(antes.status, 200, 'la sesión de Juan debe funcionar antes de inactivarlo');

        const inactivacion = await api('PATCH', `/usuarios/${ids.juan}/estado`, { estado: 'Inactivo' });
        assert.equal(inactivacion.status, 200);

        const despues = await fetch(base + '/auth/me', { headers: { Cookie: cookieJuan } });
        const respuesta = await despues.json();
        assert.equal(despues.status, 401);
        assert.equal(respuesta.codigo, 'CUENTA_INACTIVA');
        assert.match(despues.headers.get('set-cookie') || '', /Max-Age=0/);
    } finally {
        await api('PATCH', `/usuarios/${ids.juan}/estado`, { estado: 'Activo' });
    }
});
