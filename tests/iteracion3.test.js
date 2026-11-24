process.env.AUTOSCOL_TEST_MODE = '1';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { app, pool } = require('../server');
const { restaurarDatosDePrueba } = require('./ayuda');
const { hashPassword } = require('../auth');
const tarifas = require('../config/tarifas');

let servidor, base, cookieAdmin = '';
const api = async (metodo, ruta, cuerpo, cookie = cookieAdmin) => {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;
  const r = await fetch(base + ruta, { method: metodo, headers, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  return { status: r.status, body: await r.json() };
};
before(async () => {
  await restaurarDatosDePrueba(pool);
  await pool.query("UPDATE Usuario SET usuario_login='ea3admin', password_hash=$1, tipo_usuario='Administrador', estado='Activo' WHERE documento='9999999999'",
    [hashPassword('EA3-Pruebas-Admin!')]);
  await new Promise(ok => { servidor = app.listen(0, ok); });
  base = `http://127.0.0.1:${servidor.address().port}/api`;
  const r = await fetch(base + '/auth/login', { method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({usuario:'ea3admin',password:'EA3-Pruebas-Admin!'}) });
  assert.equal(r.status, 200);
  cookieAdmin = r.headers.get('set-cookie').split(';')[0];
});
after(async () => { servidor.close(); await restaurarDatosDePrueba(pool); await pool.end(); });

test('EA3: las tarifas oficiales son $250.000 para automóviles/camionetas y $100.000 para motos', () => {
  assert.equal(tarifas.VALOR.Automovil, 250000);
  assert.equal(tarifas.VALOR.Camioneta, 250000);
  assert.equal(tarifas.VALOR.Motocicleta, 100000);
});

test('EA3: consulta de historial y resumen de pagos requiere administrador', async () => {
  const sinSesion = await api('GET', '/pagos', undefined, '');
  assert.equal(sinSesion.status, 401);
  const r = await api('GET', '/pagos');
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.body.pagos));
  assert.ok(r.body.resumen);
  assert.ok(Number.isInteger(r.body.total));
});

test('EA3: filtros y validaciones del historial de pagos', async () => {
  assert.equal((await api('GET', '/pagos?estado=Inventado')).body.codigo, 'FILTRO_INVALIDO');
  assert.equal((await api('GET', '/pagos?desde=2026-99-99')).body.codigo, 'FILTRO_INVALIDO');
  assert.equal((await api('GET', '/pagos?pagina=0')).body.codigo, 'PAGINACION_INVALIDA');
  const r = await api('GET', '/pagos?estado=Aprobado&placa=ABC123&limite=5&pagina=1');
  assert.equal(r.status, 200);
  assert.ok(r.body.pagos.every(p => p.estado_pago === 'Aprobado' && p.placa === 'ABC123'));
});
