const crypto = require('crypto');
const sessions = new Map();
const COOKIE = 'autoscolombia_sid';
const TTL_MS = 8 * 60 * 60 * 1000;
const ROLES = ['Administrador', 'Operario', 'Cliente'];

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derived = crypto.scryptSync(String(password), salt, 64);
  return `${salt}:${derived.toString('hex')}`;
}
function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hex] = stored.split(':');
  const actual = crypto.scryptSync(String(password), salt, 64);
  const expected = Buffer.from(hex, 'hex');
  return expected.length === actual.length && crypto.timingSafeEqual(actual, expected);
}
function cookieOptions(maxAge) {
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${process.env.COOKIE_SECURE === 'true' ? '; Secure' : ''}`;
}
function crearSesion(res, usuario) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { id: usuario.id_usuario, username: usuario.usuario_login, nombre: usuario.nombre,
    rol: usuario.tipo_usuario, expira: Date.now() + TTL_MS });
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; ${cookieOptions(TTL_MS / 1000)}`);
}
function destruirSesion(req, res) {
  const token = req.cookies?.[COOKIE] || leerCookie(req, COOKIE);
  if (token) sessions.delete(token);
  res.setHeader('Set-Cookie', `${COOKIE}=; ${cookieOptions(0)}`);
}
function leerCookie(req, nombre) {
  const raw = req.headers.cookie || '';
  const item = raw.split(';').map(x => x.trim()).find(x => x.startsWith(`${nombre}=`));
  return item ? decodeURIComponent(item.slice(nombre.length + 1)) : null;
}
function requireAuth(req, res, next) {
  const token = leerCookie(req, COOKIE);
  const sesion = token && sessions.get(token);
  if (!sesion || sesion.expira < Date.now()) {
    if (token) sessions.delete(token);
    return res.status(401).json({ error: 'Debe iniciar sesión para continuar.', codigo: 'NO_AUTENTICADO' });
  }
  req.user = { id: sesion.id, username: sesion.username, nombre: sesion.nombre, rol: sesion.rol };
  next();
}
function allowRoles(...roles) {
  return (req, res, next) => roles.includes(req.user?.rol)
    ? next()
    : res.status(403).json({ error: 'No tiene permisos para realizar esta operación.', codigo: 'SIN_PERMISOS' });
}
module.exports = { hashPassword, verifyPassword, crearSesion, destruirSesion, requireAuth, allowRoles, ROLES };
