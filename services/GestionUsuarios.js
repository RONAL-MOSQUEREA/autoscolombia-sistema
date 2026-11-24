// BusinessLogic - IteraciÃ³n 2: gestiÃ³n de usuarios y de sus vehÃ­culos. Implementa IGestionUsuarios.
const { Usuario, Vehiculo, DomainError } = require('../models');
const { verificarImplementacion } = require('./IGestionUsuarios');
const ValidadorMensualidad = require('./ValidadorMensualidad');
const { idPositivo, filtroDeLista } = require('./utilidades');
const { hashPassword } = require('../auth');

class GestionUsuarios {
    constructor({ enTransaccion, pool, repos }) {
        this.enTransaccion = enTransaccion;
        this.pool = pool;
        this.repos = repos;
        this.validadorMensualidad = new ValidadorMensualidad(repos);
        verificarImplementacion(this);
    }

    async _usuarioOError(ex, id, bloquear = false) {
        const usuario = await this.repos.usuarios.buscarPorId(ex, id, { bloquear });
        if (!usuario) throw new DomainError('USUARIO_NO_ENCONTRADO', 'El usuario no existe.', 404);
        return usuario;
    }

    // Â¿Alguno de los vehÃ­culos del usuario estÃ¡ dentro del parqueadero ahora mismo?
    async _vehiculosDentro(ex, id_usuario) {
        const vehiculos = await this.repos.vehiculos.listarPorUsuario(ex, id_usuario);
        const dentro = [];
        for (const v of vehiculos) {
            if (await this.repos.accesos.buscarActivoPorPlaca(ex, v.placa)) dentro.push(v.placa);
        }
        return dentro;
    }

    // ---- RF07: registrar usuario --------------------------------------------
    async registrarUsuario(datos) {
        const campos = Usuario.validarDatos(datos);
        return this.enTransaccion(async (tx) => {
            if (await this.repos.usuarios.buscarPorDocumento(tx, campos.documento)) {
                throw new DomainError('DOCUMENTO_DUPLICADO', `Ya existe un usuario con el documento ${campos.documento}.`, 409);
            }
            const usuario = await this.repos.usuarios.crear(tx, campos);
            return { mensaje: 'Usuario registrado exitosamente.', usuario };
        });
    }

    // ---- RF08: consultar / buscar usuarios -----------------------------------
    async consultarUsuarios({ buscar, tipo, estado, limite, pagina } = {}) {
        const lim = limite === undefined ? 50 : Number(limite);
        const pag = pagina === undefined ? 1 : Number(pagina);
        if (!Number.isInteger(lim) || lim < 1 || lim > 200 || !Number.isInteger(pag) || pag < 1) {
            throw new DomainError('PAGINACION_INVALIDA', 'limite debe estar entre 1 y 200 y pagina debe ser 1 o mayor.', 400);
        }
        const resultado = await this.repos.usuarios.listar(this.pool, {
            buscar: buscar ? String(buscar).trim().slice(0, 100) : null,
            tipo: filtroDeLista(tipo, Usuario.TIPOS, 'tipo'),
            estado: filtroDeLista(estado, Usuario.ESTADOS, 'estado'),
            limite: lim, desplazamiento: (pag - 1) * lim
        });
        return { ...resultado, pagina: pag, limite: lim };
    }

    // ---- RF09: detalle del usuario con sus vehÃ­culos y el estado de cada mensualidad
    async consultarUsuario(idCrudo) {
        const id = idPositivo(idCrudo, 'del usuario');
        const usuario = await this._usuarioOError(this.pool, id);
        const hoy = await this.repos.mensualidades.fechaActual(this.pool);
        const vehiculos = [];
        for (const v of await this.repos.vehiculos.listarPorUsuario(this.pool, id)) {
            const mensualidad = await this.validadorMensualidad.clasificar(this.pool, v.placa, hoy);
            const activo = await this.repos.accesos.buscarActivoPorPlaca(this.pool, v.placa);
            vehiculos.push({ ...v, mensualidad, dentro_del_parqueadero: !!activo });
        }
        return { usuario, vehiculos };
    }

    // ---- RF10: actualizar datos del usuario (solo los campos enviados) --------
    async actualizarUsuario(idCrudo, datos) {
        const id = idPositivo(idCrudo, 'del usuario');
        const campos = Usuario.validarDatos(datos, { parcial: true });
        return this.enTransaccion(async (tx) => {
            const actual = await this._usuarioOError(tx, id, true);
            if (campos.documento && campos.documento !== actual.documento) {
                const otro = await this.repos.usuarios.buscarPorDocumento(tx, campos.documento);
                if (otro) throw new DomainError('DOCUMENTO_DUPLICADO', `Ya existe un usuario con el documento ${campos.documento}.`, 409);
            }
            // Un usuario con vehÃ­culos solo puede ser Cliente
            if (campos.tipo_usuario && campos.tipo_usuario !== 'Cliente') {
                const vehiculos = await this.repos.vehiculos.listarPorUsuario(tx, id);
                if (vehiculos.length) {
                    throw new DomainError('USUARIO_CON_VEHICULOS',
                        'No se puede cambiar el tipo: el usuario tiene vehÃ­culos registrados (solo los Clientes tienen vehÃ­culos).', 409);
                }
            }
            const usuario = await this.repos.usuarios.actualizar(tx, id, campos);
            return { mensaje: 'Usuario actualizado exitosamente.', usuario };
        });
    }

    // ---- RF11: inactivar / reactivar (baja lÃ³gica: el usuario nunca se borra) --
    async cambiarEstadoUsuario(idCrudo, estado) {
        const id = idPositivo(idCrudo, 'del usuario');
        if (!Usuario.ESTADOS.includes(estado)) {
            throw new DomainError('ESTADO_INVALIDO', `El estado debe ser: ${Usuario.ESTADOS.join(', ')}.`, 400);
        }
        return this.enTransaccion(async (tx) => {
            const usuario = await this._usuarioOError(tx, id, true); // el bloqueo tambiÃ©n serializa con los ingresos
            if (usuario.estado === estado) {
                return { mensaje: `El usuario ya estaba ${estado.toLowerCase()}.`, id_usuario: id, estado };
            }
            if (estado === 'Inactivo') {
                const dentro = await this._vehiculosDentro(tx, id);
                if (dentro.length) {
                    throw new DomainError('USUARIO_CON_VEHICULO_DENTRO',
                        `No se puede inactivar: ${dentro.join(', ')} estÃ¡ dentro del parqueadero. Registre primero la salida.`,
                        409, { placas: dentro });
                }
            }
            await this.repos.usuarios.cambiarEstado(tx, id, estado);
            return { mensaje: `Usuario ${estado === 'Activo' ? 'reactivado' : 'inactivado'} exitosamente.`, id_usuario: id, estado };
        });
    }

    // ---- RF12: registrar vehÃ­culo a un usuario --------------------------------
    // Asignación segura de credenciales desde la aplicación
    async asignarCredenciales(idCrudo, datos) {
        const id = idPositivo(idCrudo, 'del usuario');
        const d = datos || {};
        const usuario_login = typeof d.usuario_login === 'string' ? d.usuario_login.trim() : '';
        const password = typeof d.password === 'string' ? d.password : '';
        if (!/^[A-Za-z0-9._-]{3,40}$/.test(usuario_login)) {
            throw new DomainError('USUARIO_LOGIN_INVALIDO', 'El nombre de usuario debe tener entre 3 y 40 caracteres: letras, números, punto, guion o guion bajo.', 400);
        }
        if (password.length < 10) {
            throw new DomainError('PASSWORD_INVALIDO', 'La contraseña debe tener al menos 10 caracteres.', 400);
        }
        return this.enTransaccion(async (tx) => {
            const usuario = await this._usuarioOError(tx, id, true);
            if (!usuario.estaActivo()) {
                throw new DomainError('USUARIO_INACTIVO', 'No se pueden asignar credenciales a un usuario inactivo.', 409);
            }
            const actualizado = await this.repos.usuarios.asignarCredenciales(tx, id, {
                usuario_login,
                password_hash: hashPassword(password)
            });
            if (!actualizado) {
                throw new DomainError('USUARIO_INACTIVO', 'La cuenta no está activa y no puede recibir credenciales.', 409);
            }
            return { mensaje: 'Credenciales asignadas exitosamente.', usuario: actualizado };
        });
    }
    async registrarVehiculo(idCrudo, datos) {
        const id = idPositivo(idCrudo, 'del usuario');
        const d = datos || {};
        const placa = Vehiculo.normalizarPlaca(d.placa);
        if (!Vehiculo.esPlacaValida(placa)) {
            throw new DomainError('PLACA_INVALIDA', 'La placa no tiene un formato vÃ¡lido (ej: ABC123 o ABC12D).', 400);
        }
        const campos = Vehiculo.validarDatos(d);
        return this.enTransaccion(async (tx) => {
            const usuario = await this._usuarioOError(tx, id, true);
            if (!usuario.estaActivo()) {
                throw new DomainError('USUARIO_INACTIVO', 'No se pueden registrar vehÃ­culos a un usuario inactivo.', 409);
            }
            if (!usuario.esCliente()) {
                throw new DomainError('TIPO_USUARIO_SIN_VEHICULOS', 'Solo los usuarios de tipo Cliente pueden tener vehÃ­culos.', 409);
            }
            if (await this.repos.vehiculos.buscarPorPlaca(tx, placa)) {
                throw new DomainError('PLACA_DUPLICADA', `La placa ${placa} ya estÃ¡ registrada.`, 409);
            }
            const vehiculo = await this.repos.vehiculos.crear(tx, { placa, id_usuario: id, ...campos });
            return { mensaje: 'VehÃ­culo registrado exitosamente.', vehiculo };
        });
    }

    // ---- RF13: actualizar vehÃ­culo (datos, tipo o cambio de propietario) -------
    async actualizarVehiculo(placaCruda, datos) {
        const placa = Vehiculo.normalizarPlaca(placaCruda);
        if (!Vehiculo.esPlacaValida(placa)) {
            throw new DomainError('PLACA_INVALIDA', 'La placa no tiene un formato vÃ¡lido (ej: ABC123 o ABC12D).', 400);
        }
        const d = datos || {};
        const campos = Vehiculo.validarDatos(d, { parcial: true });
        let nuevoPropietario = null;
        if (d.id_usuario !== undefined) nuevoPropietario = idPositivo(d.id_usuario, 'del nuevo propietario');
        if (Object.keys(campos).length === 0 && nuevoPropietario === null) {
            throw new DomainError('DATOS_INCOMPLETOS', 'Indique al menos un campo a actualizar.', 400);
        }
        return this.enTransaccion(async (tx) => {
            const vehiculo = await this.repos.vehiculos.buscarPorPlaca(tx, placa, { bloquear: true });
            if (!vehiculo) throw new DomainError('VEHICULO_NO_REGISTRADO', `El vehÃ­culo con placa ${placa} no estÃ¡ registrado.`, 404);

            const cambiaTipo = campos.tipo && campos.tipo !== vehiculo.tipo;
            const cambiaDueno = nuevoPropietario !== null && nuevoPropietario !== vehiculo.id_usuario;
            if ((cambiaTipo || cambiaDueno) && await this.repos.accesos.buscarActivoPorPlaca(tx, placa)) {
                throw new DomainError('VEHICULO_DENTRO',
                    'No se puede cambiar el tipo ni el propietario mientras el vehÃ­culo estÃ¡ dentro del parqueadero.', 409);
            }
            if (cambiaDueno) {
                const dueno = await this._usuarioOError(tx, nuevoPropietario, true);
                if (!dueno.estaActivo() || !dueno.esCliente()) {
                    throw new DomainError('PROPIETARIO_NO_VALIDO', 'El nuevo propietario debe ser un Cliente activo.', 409);
                }
                campos.id_usuario = nuevoPropietario;
            }
            const actualizado = await this.repos.vehiculos.actualizar(tx, placa, campos);
            return { mensaje: 'VehÃ­culo actualizado exitosamente.', vehiculo: actualizado };
        });
    }
}

module.exports = GestionUsuarios;

