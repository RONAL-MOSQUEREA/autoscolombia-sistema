// Capa Presentation (API) - Iteración 2: celdas. Traduce HTTP <-> IGestionCeldas.
const manejar = require('./envolver');

module.exports = (gestion /* implementa IGestionCeldas */) => ({
    consultarCeldas:    manejar(200, (req) => gestion.consultarCeldas(req.query)),
    consultarCelda:     manejar(200, (req) => gestion.consultarCelda(req.params.id)),
    registrarCelda:     manejar(201, (req) => gestion.registrarCelda(req.body || {})),
    actualizarCelda:    manejar(200, (req) => gestion.actualizarCelda(req.params.id, req.body || {})),
    cambiarEstadoCelda: manejar(200, (req) => gestion.cambiarEstadoCelda(req.params.id, (req.body || {}).estado)),
    eliminarCelda:      manejar(200, (req) => gestion.eliminarCelda(req.params.id))
});
