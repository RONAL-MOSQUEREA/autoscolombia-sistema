// Capa Presentation: traduce CUALQUIER error a una respuesta JSON coherente.
// AsÃ­ el cliente nunca recibe HTML ni trazas internas.
const { DomainError } = require('../models');

// Errores que indican que la base de datos no estÃ¡ disponible o mal configurada:
//  red (ECONNREFUSED...), 28P01/28000 = contraseÃ±a o usuario incorrecto, 3D000 = la base no existe,
//  57P01-57P03 = servidor apagÃ¡ndose, 08xxx = fallo de conexiÃ³n, 53300 = demasiadas conexiones
const ERRORES_CONEXION = new Set([
    'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN',
    '28P01', '28000', '3D000', '57P01', '57P02', '57P03', '08000', '08001', '08003', '08006', '53300'
]);

// Respaldo de las reglas de unicidad de la BD ante dos peticiones simultÃ¡neas
// (la validaciÃ³n normal ocurre antes, en la capa de negocio)
const DUPLICADOS = {
    uq_acceso_placa_activa: ['INGRESO_DUPLICADO', 'El vehÃ­culo ya tiene un ingreso activo.'],
    uq_usuario_documento:   ['DOCUMENTO_DUPLICADO', 'Ya existe un usuario con ese documento.'],
    uq_usuario_login_lower: ['USUARIO_LOGIN_DUPLICADO', 'Ese nombre de usuario ya está asignado.'],
    vehiculo_pkey:          ['PLACA_DUPLICADA', 'Esa placa ya estÃ¡ registrada.'],
    uq_celda_numero:        ['CELDA_DUPLICADA', 'Ya existe una celda con ese nÃºmero.']
};

function traducirError(error) {
    if (error instanceof DomainError) {
        return { status: error.status, cuerpo: { error: error.message, codigo: error.codigo, ...error.extra } };
    }
    // Errores del parser JSON (express.json)
    if (error.type === 'entity.parse.failed') {
        return { status: 400, cuerpo: { error: 'El cuerpo de la peticiÃ³n no es un JSON vÃ¡lido.', codigo: 'JSON_INVALIDO' } };
    }
    if (error.type === 'entity.too.large') {
        return { status: 413, cuerpo: { error: 'El cuerpo de la peticiÃ³n es demasiado grande.', codigo: 'CUERPO_MUY_GRANDE' } };
    }
    // Respaldo de las reglas de unicidad de la BD (la regla principal se valida en la capa de negocio)
    if (error.code === '23505' && DUPLICADOS[error.constraint]) {
        const [codigo, mensaje] = DUPLICADOS[error.constraint];
        return { status: 409, cuerpo: { error: mensaje, codigo } };
    }
    if (error.code === '23503') { // llave forÃ¡nea: el registro estÃ¡ referenciado por otro
        return { status: 409, cuerpo: { error: 'El registro estÃ¡ relacionado con otros datos y no se puede modificar asÃ­.', codigo: 'REGISTRO_RELACIONADO' } };
    }
    if (['40P01', '40001', '55P03', '23505'].includes(error.code)) { // deadlock, serializaciÃ³n, bloqueo, duplicado
        return { status: 503, cuerpo: { error: 'El sistema estÃ¡ ocupado. Intente de nuevo en unos segundos.', codigo: 'CONFLICTO_CONCURRENCIA' } };
    }
    if (ERRORES_CONEXION.has(error.code)) {
        return { status: 503, cuerpo: { error: 'La base de datos no estÃ¡ disponible. Verifique que PostgreSQL estÃ© encendido y el archivo .env sea correcto.', codigo: 'BD_NO_DISPONIBLE' } };
    }
    return { status: 500, cuerpo: { error: 'Error interno del servidor.', codigo: 'ERROR_INTERNO' } };
}

// Middleware de Express (4 argumentos: asÃ­ Express lo reconoce como manejador de errores)
// eslint-disable-next-line no-unused-vars
function manejadorErrores(error, req, res, next) {
    const { status, cuerpo } = traducirError(error);
    if (status >= 500) console.error(error); // solo se registran los fallos reales, no los de validaciÃ³n
    if (res.headersSent) return next(error);
    res.status(status).json(cuerpo);
}

function rutaNoEncontrada(req, res) {
    res.status(404).json({ error: `La ruta ${req.method} ${req.originalUrl} no existe.`, codigo: 'RUTA_NO_ENCONTRADA' });
}

module.exports = { traducirError, manejadorErrores, rutaNoEncontrada };

