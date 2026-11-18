const { test } = require('node:test');
const assert = require('node:assert/strict');
const { hashPassword, verifyPassword, crearSesion, requireAuth, allowRoles } = require('../auth');

test('las contraseñas se almacenan como hash con salt y se verifican', () => {
  const hash = hashPassword('Clave-Privada-2026!');
  assert.notEqual(hash, 'Clave-Privada-2026!');
  assert.equal(verifyPassword('Clave-Privada-2026!', hash), true);
  assert.equal(verifyPassword('otra-clave', hash), false);
});

test('la sesión autenticada identifica usuario y rol', () => {
  const headers = {};
  const res = { setHeader: (k, v) => { headers[k] = v; } };
  crearSesion(res, { id_usuario: 7, usuario_login: 'admin', nombre: 'Admin', tipo_usuario: 'Administrador' });
  const cookie = headers['Set-Cookie'].split(';')[0];
  const req = { headers: { cookie } };
  let siguiente = false;
  requireAuth(req, res, () => { siguiente = true; });
  assert.equal(siguiente, true);
  assert.equal(req.user.rol, 'Administrador');
  assert.equal(req.user.id, 7);
});

test('el middleware de rol rechaza a quien no tiene permiso', () => {
  let statusCode, payload, siguiente = false;
  const res = { status: (n) => { statusCode = n; return res; }, json: (v) => { payload = v; } };
  allowRoles('Administrador')({ user: { rol: 'Operario' } }, res, () => { siguiente = true; });
  assert.equal(siguiente, false);
  assert.equal(statusCode, 403);
  assert.equal(payload.codigo, 'SIN_PERMISOS');
});
