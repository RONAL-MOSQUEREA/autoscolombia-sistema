const express = require('express');
const crypto = require('crypto');
const { crearRequireAuth, allowRoles } = require('../auth');
const hash = (t) => crypto.createHash('sha256').update(String(t)).digest();
function protegerConfirmacionPago(req, res, next, requireAuth) {
  const recibido = req.get('x-webhook-secret') || '';
  const esperado = process.env.PAGO_WEBHOOK_SECRET;
  if (recibido) {
    if (!esperado) return res.status(503).json({ error: 'El webhook no estÃ¡ configurado en el servidor.', codigo: 'WEBHOOK_NO_CONFIGURADO' });
    if (crypto.timingSafeEqual(hash(recibido), hash(esperado))) return next();
    return res.status(401).json({ error: 'Secreto del Sistema de Pago invÃ¡lido.', codigo: 'NO_AUTORIZADO' });
  }
  return requireAuth(req, res, () => allowRoles('Administrador')(req, res, next));
}
module.exports = ({ operaciones: c, usuarios, celdas, pool }) => {
  const requireAuth = crearRequireAuth(pool);
  const router = express.Router();
  // Webhook externo: requiere secreto propio y no depende de una sesiÃ³n humana.
  router.post('/pagos/confirmacion', (req, res, next) => protegerConfirmacionPago(req, res, next, requireAuth), c.confirmarPago);
  // AutenticaciÃ³n obligatoria para las funciones internas del parqueadero.
  router.use(requireAuth);
  // OperaciÃ³n: administrador y operario.
  router.get('/vehiculos/:placa/estado', allowRoles('Administrador','Operario'), c.consultarEstadoVehiculo);
  router.post('/ingresos', allowRoles('Administrador','Operario'), c.registrarIngreso);
  router.post('/salidas', allowRoles('Administrador','Operario'), c.registrarSalida);
  router.get('/dashboard', allowRoles('Administrador','Operario'), c.consultarDashboard);
  router.post('/novedades', allowRoles('Administrador','Operario'), c.registrarNovedad);
  router.get('/novedades/:placa', allowRoles('Administrador','Operario'), c.consultarNovedades);
  // AdministraciÃ³n: Ãºnicamente administradores.
  router.get('/celdas', allowRoles('Administrador'), celdas.consultarCeldas);
  router.post('/celdas', allowRoles('Administrador'), celdas.registrarCelda);
  router.get('/celdas/:id', allowRoles('Administrador'), celdas.consultarCelda);
  router.put('/celdas/:id', allowRoles('Administrador'), celdas.actualizarCelda);
  router.patch('/celdas/:id/estado', allowRoles('Administrador'), celdas.cambiarEstadoCelda);
  router.delete('/celdas/:id', allowRoles('Administrador'), celdas.eliminarCelda);
  router.get('/usuarios', allowRoles('Administrador'), usuarios.consultarUsuarios);
  router.post('/usuarios', allowRoles('Administrador'), usuarios.registrarUsuario);
  router.get('/usuarios/:id', allowRoles('Administrador'), usuarios.consultarUsuario);
  router.put('/usuarios/:id', allowRoles('Administrador'), usuarios.actualizarUsuario);
  router.patch('/usuarios/:id/estado', allowRoles('Administrador'), usuarios.cambiarEstadoUsuario);
  router.patch('/usuarios/:id/credenciales', allowRoles('Administrador'), usuarios.asignarCredenciales);
  router.post('/usuarios/:id/vehiculos', allowRoles('Administrador'), usuarios.registrarVehiculo);
  router.put('/vehiculos/:placa', allowRoles('Administrador'), usuarios.actualizarVehiculo);
  router.post('/mensualidades', allowRoles('Administrador'), c.registrarMensualidad);
  router.get('/pagos', allowRoles('Administrador'), c.consultarPagos);
  return router;
};


