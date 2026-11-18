// Capa Presentation (API): traduce HTTP <-> IControlOperaciones. NO contiene reglas de negocio.
const manejar = require('./envolver');

module.exports = (control /* implementa IControlOperaciones */) => ({
    registrarIngreso:    manejar(201, (req) => control.registrarIngreso(req.body || {})),
    consultarEstadoVehiculo: manejar(200, (req) => control.consultarEstadoVehiculo(req.params.placa)),
    registrarSalida:     manejar(200, (req) => control.registrarSalida(req.body || {})),
    consultarDashboard:  manejar(200, () => control.consultarDashboard()),
    registrarNovedad:    manejar(201, (req) => control.registrarNovedad(req.body || {})),
    consultarNovedades:  manejar(200, (req) => control.consultarNovedades(req.params.placa)),
    registrarMensualidad: manejar(201, (req) => control.registrarMensualidad(req.body || {})),
    confirmarPago:       manejar(200, (req) => control.confirmarPago(req.body || {}))
});
