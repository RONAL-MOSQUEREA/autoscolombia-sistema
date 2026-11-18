// Capa Presentation (API) - Iteración 2: usuarios y vehículos. Traduce HTTP <-> IGestionUsuarios.
const manejar = require('./envolver');

module.exports = (gestion /* implementa IGestionUsuarios */) => ({
    registrarUsuario:     manejar(201, (req) => gestion.registrarUsuario(req.body || {})),
    consultarUsuarios:    manejar(200, (req) => gestion.consultarUsuarios(req.query)),
    consultarUsuario:     manejar(200, (req) => gestion.consultarUsuario(req.params.id)),
    actualizarUsuario:    manejar(200, (req) => gestion.actualizarUsuario(req.params.id, req.body || {})),
    cambiarEstadoUsuario: manejar(200, (req) => gestion.cambiarEstadoUsuario(req.params.id, (req.body || {}).estado)),
    registrarVehiculo:    manejar(201, (req) => gestion.registrarVehiculo(req.params.id, req.body || {})),
    actualizarVehiculo:   manejar(200, (req) => gestion.actualizarVehiculo(req.params.placa, req.body || {}))
});
