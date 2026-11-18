// Capa Presentation: traduce CUALQUIER error a una respuesta JSON coherente.
// Así el cliente nunca recibe HTML ni trazas internas.
const { DomainError } = require('../models');

// Errores que indican que la base de datos no está disponible o mal configurada:
//  red (ECONNREFUSED...), 28P01/28000 = contraseña o usuario incorrecto, 3D000 = la base no existe,
//  57P01-57P03 = servidor apagándose, 08xxx = fallo de conexión, 53300 = demasiadas conexiones
const ERRORES_CONEXION = new Set([
    'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN',
    '28P01', '28000', '3D000', '57P01', '57P02', '57P03', '08000', '08001', '08003', '08006', '53300'
]);

// Respaldo de las reglas de unicidad de la BD ante dos peticiones simultáneas
// (la validación normal ocurre antes, en la capa de negocio)
const DUPLICADOS = {
    uq_acceso_placa_activa: ['INGRESO_DUPLICADO', 'El vehículo ya tiene un ingreso activo.'],
    uq_usuario_documento:   ['DOCUMENTO_DUPLICADO', 'Ya existe un usuario con ese documento.'],
    vehiculo_pkey:          ['PLACA_DUPLICADA', 'Esa placa ya está registrada.'],
    uq_celda_numero:        ['CELDA_DUPLICADA', 'Ya existe una celda con ese número.']
};

function traducirError(error) {
    if (error instanceof DomainError) {
        return { status: error.status, cuerpo: { error: error.message, codigo: error.codigo, ...error.extra } };
    }
    // Errores del parser JSON (express.json)
    if (error.type === 'entity.parse.failed') {
        return { status: 400, cuerpo: { error: 'El cuerpo de la petición no es un JSON válido.', codigo: 'JSON_INVALIDO' } };
    }
    if (error.type === 'entity.too.large') {
        return { status: 413, cuerpo: { error: 'El cuerpo de la petición es demasiado grande.', codigo: 'CUERPO_MUY_GRANDE' } };
    }
    // Respaldo de las reglas de unicidad de la BD (la regla principal se valida en la capa de negocio)
    if (error.code === '23505' && DUPLICADOS[error.constraint]) {
        const [codigo, mensaje] = DUPLICADOS[error.constraint];
        return { status: 409, cuerpo: { error: mensaje, codigo } };
    }
    if (error.code === '23503') { // llave foránea: el registro está referenciado por otro
        return { status: 409, cuerpo: { error: 'El registro está relacionado con otros datos y no se puede modificar así.', codigo: 'REGISTRO_RELACIONADO' } };
    }
    if (['40P01', '40001', '55P03', '23505'].includes(error.code)) { // deadlock, serialización, bloqueo, duplicado
        return { status: 503, cuerpo: { error: 'El sistema está ocupado. Intente de nuevo en unos segundos.', codigo: 'CONFLICTO_CONCURRENCIA' } };
    }
    if (ERRORES_CONEXION.has(error.code)) {
        return { status: 503, cuerpo: { error: 'La base de datos no está disponible. Verifique que PostgreSQL esté encendido y el archivo .env sea correcto.', codigo: 'BD_NO_DISPONIBLE' } };
    }
    return { status: 500, cuerpo: { error: 'Error interno del servidor.', codigo: 'ERROR_INTERNO' } };
}

// Middleware de Express (4 argumentos: así Express lo reconoce como manejador de errores)
// eslint-disable-next-line no-unused-vars
function manejadorErrores(error, req, res, next) {
    const { status, cuerpo } = traducirError(error);
    if (status >= 500) console.error(error); // solo se registran los fallos reales, no los de validación
    if (res.headersSent) return next(error);
    res.status(status).json(cuerpo);
}

function rutaNoEncontrada(req, res) {
    res.status(404).json({ error: `La ruta ${req.method} ${req.originalUrl} no existe.`, codigo: 'RUTA_NO_ENCONTRADA' });
}

module.exports = { traducirError, manejadorErrores, rutaNoEncontrada };
