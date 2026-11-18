// Error de regla de negocio: la capa Presentation lo traduce a una respuesta HTTP.
class DomainError extends Error {
    constructor(codigo, mensaje, status = 400, extra = {}) {
        super(mensaje);
        this.codigo = codigo;
        this.status = status;
        this.extra = extra;
    }
}
module.exports = DomainError;
