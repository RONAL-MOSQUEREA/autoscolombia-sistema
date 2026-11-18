// Composición de las capas: Presentation -> BusinessLogic -> DataAccess -> BD
const express = require('express');
const path = require('path');
require('dotenv').config();

const { pool, enTransaccion } = require('./config/db');            // DataAccess
const repos = require('./repositories');                           // DataAccess
const ControlOperaciones = require('./services/ControlOperaciones'); // BusinessLogic (Iteración 1)
const GestionUsuarios = require('./services/GestionUsuarios');       // BusinessLogic (Iteración 2)
const GestionCeldas = require('./services/GestionCeldas');           // BusinessLogic (Iteración 2)
const crearControlador = require('./controllers/operacionesController'); // Presentation
const crearControladorUsuarios = require('./controllers/usuariosController'); // Presentation
const crearControladorCeldas = require('./controllers/celdasController');     // Presentation
const crearRutas = require('./routes/api');
const crearAuth = require('./controllers/authController');                        // Presentation
const { manejadorErrores, rutaNoEncontrada } = require('./routes/errores'); // Presentation

const dependencias = { enTransaccion, pool, repos };
const control = new ControlOperaciones(dependencias);
const usuarios = new GestionUsuarios(dependencias);
const celdas = new GestionCeldas(dependencias);

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '20kb' })); // ninguna petición legítima se acerca a este tamaño
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api/auth', crearAuth(pool));

// Estado del servicio: 200 si la BD responde, 503 si no (útil para diagnosticar la instalación)
app.get('/api/health', async (req, res, next) => {
    try {
        await pool.query('SELECT 1');
        res.json({ estado: 'ok', base_de_datos: 'conectada' });
    } catch (error) { next(error); }
});
app.use('/api', crearRutas({
    operaciones: crearControlador(control),
    usuarios: crearControladorUsuarios(usuarios),
    celdas: crearControladorCeldas(celdas)
}));
app.use('/api', rutaNoEncontrada);   // rutas /api/... inexistentes -> JSON 404 (no HTML)
app.use(manejadorErrores);           // JSON inválido, errores de BD, errores de negocio...

const PORT = process.env.PORT || 3000;
if (require.main === module) {
    const servidor = app.listen(PORT, async () => {
        console.log(`Parqueadero "Autos Colombia" activo en http://localhost:${PORT}`);
        if (!process.env.PAGO_WEBHOOK_SECRET) {
            console.warn('AVISO: PAGO_WEBHOOK_SECRET no está definido; cualquiera puede confirmar pagos. ' +
                         'Defínalo en .env antes de usar el sistema fuera de una demostración.');
        }
        try { await pool.query('SELECT 1'); console.log('Base de datos: conexión correcta.'); }
        catch (e) { console.error(`Base de datos: NO se pudo conectar (${e.code || e.message}). ` +
                                   'Revise que PostgreSQL esté encendido y los datos de .env (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME).'); }
    });
    servidor.on('error', (e) => {
        console.error(e.code === 'EADDRINUSE' ? `El puerto ${PORT} ya está en uso. Cambie PORT en .env.` : e);
        process.exit(1);
    });
    // Cierre ordenado: termina las peticiones en curso y libera las conexiones
    const cerrar = () => servidor.close(() => pool.end().finally(() => process.exit(0)));
    process.on('SIGINT', cerrar);
    process.on('SIGTERM', cerrar);
}

module.exports = { app, pool };
