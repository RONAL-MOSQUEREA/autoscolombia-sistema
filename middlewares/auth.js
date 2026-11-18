const crypto = require('crypto');

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password, stored) {
    if (!stored || !stored.startsWith('scrypt:')) return false;
    const [, salt, key] = stored.split(':');
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);
    if (keyBuffer.length !== derivedKey.length) return false;
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
}

function crearMiddlewareAuth(pool) {
    const autenticar = async (req, res, next) => {
        const authHeader = req.headers.authorization || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
        if (!token) {
            return res.status(401).json({ error: 'Sesión requerida o no proporcionada.', codigo: 'NO_AUTORIZADO' });
        }
        try {
            const { rows } = await pool.query(
                `SELECT s.token, s.expira_en, s.revocada, u.id, u.nombre, u.username, u.tipo_usuario, u.estado
                 FROM Sesion s
                 JOIN Usuario u ON u.id = s.usuario_id
                 WHERE s.token = $1`,
                [token]
            );
            const sesion = rows[0];
            if (!sesion || sesion.revocada || new Date(sesion.expira_en) <= new Date() || sesion.estado !== 'Activo') {
                return res.status(401).json({ error: 'Sesión inválida, vencida o revocada.', codigo: 'SESION_INVALIDA' });
            }
            req.usuario = {
                id: sesion.id,
                nombre: sesion.nombre,
                username: sesion.username,
                rol: sesion.tipo_usuario
            };
            req.token = token;
            next();
        } catch (err) {
            next(err);
        }
    };

    const requerirRol = (...rolesPermitidos) => (req, res, next) => {
        if (!req.usuario) {
            return res.status(401).json({ error: 'No autenticado.', codigo: 'NO_AUTORIZADO' });
        }
        if (!rolesPermitidos.includes(req.usuario.rol)) {
            return res.status(403).json({
                error: `Acceso denegado. Se requiere rol: ${rolesPermitidos.join(' o ')}.`,
                codigo: 'PROHIBIDO_ROL'
            });
        }
        next();
    };

    return { autenticar, requerirRol };
}

module.exports = { hashPassword, verifyPassword, crearMiddlewareAuth };
