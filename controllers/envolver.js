// Envuelve un handler: éxito -> JSON con el `status` indicado; error -> next(error)
// (el middleware central routes/errores.js lo traduce a una respuesta JSON coherente).
module.exports = (status, fn) => async (req, res, next) => {
    try {
        res.status(status).json(await fn(req));
    } catch (error) {
        next(error);
    }
};
