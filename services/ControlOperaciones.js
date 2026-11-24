// BusinessLogic - implementa IControlOperaciones.
// AQUÍ se concentran las validaciones: mensualidad, duplicados, asignación de celda.
const { Vehiculo, Mensualidad, RegistroAcceso, Pago, DomainError } = require('../models');
const { verificarImplementacion } = require('./IControlOperaciones');
const ValidadorMensualidad = require('./ValidadorMensualidad');
const AsignadorCelda = require('./AsignadorCelda');
const tarifas = require('../config/tarifas');

const METODOS_PAGO = ['PSE', 'Tarjeta', 'Efectivo'];
const MAX_DESCRIPCION = 500; // caracteres de una novedad

class ControlOperaciones {
    constructor({ enTransaccion, pool, repos }) {
        this.enTransaccion = enTransaccion;
        this.pool = pool;
        this.repos = repos;
        this.validadorMensualidad = new ValidadorMensualidad(repos);
        this.asignadorCelda = new AsignadorCelda(repos);
        verificarImplementacion(this);
    }

    // ---- utilidades internas ------------------------------------------------
    async _vehiculoOError(ex, placaCruda, bloquear = false) {
        const placa = Vehiculo.normalizarPlaca(placaCruda);
        if (!Vehiculo.esPlacaValida(placa)) {
            throw new DomainError('PLACA_INVALIDA', 'La placa no tiene un formato válido (ej: ABC123 o ABC12D).', 400);
        }
        const vehiculo = await this.repos.vehiculos.buscarPorPlaca(ex, placa, { bloquear });
        if (!vehiculo) {
            throw new DomainError('VEHICULO_NO_REGISTRADO', `El vehículo con placa ${placa} no está registrado.`, 404);
        }
        return vehiculo;
    }

    // Valida y limpia el texto de una novedad (vacío -> null). Se llama ANTES de abrir la transacción.
    _textoNovedad(valor, obligatoria) {
        const texto = valor == null ? '' : String(valor).trim();
        if (!texto) {
            if (obligatoria) throw new DomainError('DATOS_INCOMPLETOS', 'La descripción de la novedad es obligatoria.', 400);
            return null;
        }
        if (texto.length > MAX_DESCRIPCION) {
            throw new DomainError('DESCRIPCION_MUY_LARGA',
                `La descripción no puede superar ${MAX_DESCRIPCION} caracteres (tiene ${texto.length}).`, 400);
        }
        return texto;
    }

    // ---- RF01 + RF02: ingreso -----------------------------------------------
    async registrarIngreso({ placa, novedad }) {
        const textoNovedad = this._textoNovedad(novedad, false);
        return this.enTransaccion(async (tx) => {
            // 1. Vehículo registrado (bloquea la fila: serializa ingresos de la misma placa)
            const vehiculo = await this._vehiculoOError(tx, placa, true);

            // 2. Rechazo de ingresos duplicados.
            //    El bloqueo de la fila del vehículo (paso 1) serializa los ingresos de la MISMA placa.
            //    La BD lo garantiza además con el índice único parcial uq_acceso_placa_activa.
            const activo = await this.repos.accesos.buscarActivoPorPlaca(tx, vehiculo.placa);
            if (activo) {
                throw new DomainError('INGRESO_DUPLICADO',
                    `El vehículo ${vehiculo.placa} ya tiene un ingreso activo (ticket ${activo.codigo_ticket}).`,
                    409, { codigo_ticket: activo.codigo_ticket });
            }

            // 2b. Iteración 2: el propietario debe estar activo (se bloquea su fila: serializa con la inactivación)
            const propietario = await this.repos.usuarios.buscarPorId(tx, vehiculo.id_usuario, { bloquear: true });
            if (propietario && !propietario.estaActivo()) {
                throw new DomainError('USUARIO_INACTIVO',
                    `El propietario de ${vehiculo.placa} (${propietario.nombre}) está inactivo; el vehículo no puede ingresar.`, 403);
            }

            // 3. Validación de mensualidad (bloquea si está vencida / no existe)
            const hoy = await this.repos.mensualidades.fechaActual(tx);
            const vigencia = await this.validadorMensualidad.validar(tx, vehiculo, hoy);

            // 4. Asignación automática de celda compatible
            const celda = await this.asignadorCelda.asignar(tx, vehiculo);

            // 5. Registro del acceso + celda ocupada + novedad opcional (misma transacción)
            const codigo_ticket = RegistroAcceso.generarCodigoTicket();
            const id_registro = await this.repos.accesos.crear(tx, {
                placa: vehiculo.placa, id_celda: celda.id_celda, codigo_ticket });
            await this.repos.celdas.cambiarEstado(tx, celda.id_celda, 'Ocupada');

            let id_novedad = null;
            if (textoNovedad) {
                id_novedad = await this.repos.novedades.crear(tx, {
                    placa: vehiculo.placa, id_registro, descripcion: textoNovedad });
            }

            const registro = await this.repos.accesos.obtenerConPermanencia(tx, id_registro);
            return {
                mensaje: 'Ingreso registrado exitosamente.',
                id_registro, codigo_ticket, placa: vehiculo.placa,
                celda: { id_celda: celda.id_celda, numero_celda: celda.numero_celda, tipo: celda.tipo },
                fecha_entrada: registro.fecha_entrada,
                mensualidad: { vigente_hasta: vigencia.fecha_fin, dias_restantes: vigencia.dias_restantes },
                alerta: vigencia.alerta, id_novedad
            };
        });
    }

    // ---- RF02: consulta previa al ingreso (no modifica nada) -------------------
    async consultarEstadoVehiculo(placa) {
        const vehiculo = await this._vehiculoOError(this.pool, placa);
        const hoy = await this.repos.mensualidades.fechaActual(this.pool);
        const mensualidad = await this.validadorMensualidad.clasificar(this.pool, vehiculo.placa, hoy);
        const activo = await this.repos.accesos.buscarActivoPorPlaca(this.pool, vehiculo.placa);
        let ingreso_activo = null;
        if (activo) {
            const celda = await this.repos.celdas.buscarPorId(this.pool, activo.id_celda);
            ingreso_activo = { codigo_ticket: activo.codigo_ticket, numero_celda: celda.numero_celda,
                               fecha_entrada: activo.fecha_entrada };
        }
        const propietario = await this.repos.usuarios.buscarPorId(this.pool, vehiculo.id_usuario);
        let motivo = null;
        if (ingreso_activo) motivo = 'El vehículo ya se encuentra dentro del parqueadero.';
        else if (propietario && !propietario.estaActivo()) motivo = 'El propietario del vehículo está inactivo.';
        else if (!mensualidad.vigente) motivo = mensualidad.estado === 'Vencida'
            ? `Mensualidad vencida el ${mensualidad.fecha_fin}.` : 'No tiene mensualidad vigente.';
        return {
            placa: vehiculo.placa, tipo: vehiculo.tipo, marca: vehiculo.marca, modelo: vehiculo.modelo, color: vehiculo.color,
            propietario: propietario ? { id_usuario: propietario.id_usuario, nombre: propietario.nombre, estado: propietario.estado } : null,
            mensualidad, ingreso_activo, puede_ingresar: !motivo, motivo
        };
    }

    // ---- RF03: salida (por placa o por código de ticket) ---------------------
    async registrarSalida({ placa, codigo_ticket }) {
        const ticket = codigo_ticket ? String(codigo_ticket).trim().toUpperCase() : null;
        if (!placa && !ticket) {
            throw new DomainError('DATOS_INCOMPLETOS', 'Debe indicar la placa o el código de ticket.', 400);
        }
        return this.enTransaccion(async (tx) => {
            const placaNorm = placa ? Vehiculo.normalizarPlaca(placa) : null;
            let registro = ticket
                ? await this.repos.accesos.buscarActivoPorTicket(tx, ticket, { bloquear: true })
                : await this.repos.accesos.buscarActivoPorPlaca(tx, placaNorm, { bloquear: true });

            // Salida sin ingreso activo
            if (!registro) {
                throw new DomainError('SIN_INGRESO_ACTIVO',
                    'No existe un ingreso activo para la placa o el ticket indicado.', 404);
            }
            if (placaNorm && registro.placa !== placaNorm) {
                throw new DomainError('TICKET_NO_COINCIDE', 'El ticket no corresponde a la placa indicada.', 409);
            }

            await this.repos.accesos.finalizar(tx, registro.id_registro);
            await this.repos.celdas.liberar(tx, registro.id_celda);

            const cerrado = await this.repos.accesos.obtenerConPermanencia(tx, registro.id_registro);
            const celda = await this.repos.celdas.buscarPorId(tx, registro.id_celda);

            // La salida NUNCA se bloquea por mensualidad; solo se informa
            const hoy = await this.repos.mensualidades.fechaActual(tx);
            const ultima = await this.repos.mensualidades.ultimaPagada(tx, registro.placa);
            let alerta = null;
            if (!ultima || ultima.estaVencida(hoy)) {
                alerta = 'La mensualidad no está vigente: debe renovarla antes del próximo ingreso.';
            } else if (new Mensualidad(ultima).diasRestantes(hoy) <= tarifas.DIAS_ALERTA_VENCIMIENTO) {
                alerta = `La mensualidad vence el ${ultima.fecha_fin}. Recuerde renovarla.`;
            }

            return {
                mensaje: 'Salida registrada y celda liberada con éxito.',
                id_registro: registro.id_registro, codigo_ticket: registro.codigo_ticket, placa: registro.placa,
                celda: { id_celda: celda.id_celda, numero_celda: celda.numero_celda },
                fecha_entrada: cerrado.fecha_entrada, fecha_salida: cerrado.fecha_salida,
                tiempo_permanencia_min: cerrado.minutos,
                tiempo_permanencia: RegistroAcceso.formatearPermanencia(cerrado.minutos),
                cobro_por_estancia: 0, // el servicio está cubierto por la mensualidad
                mensualidad_vigente_hasta: ultima ? ultima.fecha_fin : null,
                alerta
            };
        });
    }

    // ---- RF04: celdas y dashboard ---------------------------------------------
    async consultarDashboard() {
        const db = this.pool;
        const [celdas, activos, vigencias, hoy, novedades] = await Promise.all([
            this.repos.celdas.listar(db), this.repos.accesos.activos(db),
            this.repos.mensualidades.vigenciaPorVehiculo(db), this.repos.mensualidades.fechaActual(db),
            this.repos.novedades.recientes(db, 5)
        ]);
        const contar = (e) => celdas.filter(c => c.estado === e).length;
        const clasificadas = vigencias.map(v => {
            const dias = v.fecha_fin ? Math.round((Date.parse(v.fecha_fin) - Date.parse(hoy)) / 86400000) : null;
            let estado = 'Sin mensualidad';
            if (dias !== null) estado = dias < 0 ? 'Vencida' : (dias <= tarifas.DIAS_ALERTA_VENCIMIENTO ? 'Por vencer' : 'Vigente');
            return { placa: v.placa, propietario: v.propietario, fecha_fin: v.fecha_fin, dias_restantes: dias, estado };
        });
        return {
            fecha: hoy,
            celdas: { total: celdas.length, disponibles: contar('Disponible'), ocupadas: contar('Ocupada'),
                      mantenimiento: contar('Mantenimiento') },
            vehiculos_en_parqueadero: activos,
            mensualidades: clasificadas,
            novedades_recientes: novedades
        };
    }

    // ---- RF05: novedades --------------------------------------------------------
    async registrarNovedad({ placa, descripcion }) {
        const texto = this._textoNovedad(descripcion, true);
        return this.enTransaccion(async (tx) => {
            const vehiculo = await this._vehiculoOError(tx, placa);
            const activo = await this.repos.accesos.buscarActivoPorPlaca(tx, vehiculo.placa);
            const id_novedad = await this.repos.novedades.crear(tx, {
                placa: vehiculo.placa, id_registro: activo ? activo.id_registro : null,
                descripcion: texto });
            return { mensaje: 'Novedad registrada exitosamente.', id_novedad, placa: vehiculo.placa,
                     id_registro: activo ? activo.id_registro : null };
        });
    }

    async consultarNovedades(placa) {
        const vehiculo = await this._vehiculoOError(this.pool, placa);
        return this.repos.novedades.listarPorPlaca(this.pool, vehiculo.placa);
    }

    // ---- RF06: mensualidad y pago -------------------------------------------------
    async registrarMensualidad({ placa, meses = 1, metodo_pago }) {
        const n = typeof meses === 'boolean' ? NaN : Number(meses);
        if (!Number.isInteger(n) || n < 1 || n > 12) {
            throw new DomainError('MESES_INVALIDOS', 'Los meses deben ser un entero entre 1 y 12.', 400);
        }
        if (!METODOS_PAGO.includes(metodo_pago)) {
            throw new DomainError('METODO_INVALIDO', `Método de pago inválido. Use: ${METODOS_PAGO.join(', ')}.`, 400);
        }
        return this.enTransaccion(async (tx) => {
            const vehiculo = await this._vehiculoOError(tx, placa, true);
            const hoy = await this.repos.mensualidades.fechaActual(tx);

            // Un solo pago pendiente por placa: evita apilar mensualidades sin pagar hacia el futuro.
            // Si el pendiente ya expiró, se anula y se permite generar uno nuevo.
            for (const pendiente of await this.repos.pagos.pendientesDePlaca(tx, vehiculo.placa)) {
                if (pendiente.horas < tarifas.HORAS_EXPIRA_PAGO_PENDIENTE) {
                    throw new DomainError('PAGO_PENDIENTE',
                        `La placa ${vehiculo.placa} ya tiene un pago pendiente (ref. ${pendiente.referencia_externa}). ` +
                        'Confírmelo o espere a que expire para generar uno nuevo.', 409,
                        { referencia_externa: pendiente.referencia_externa });
                }
                await this.repos.pagos.cambiarEstado(tx, pendiente.id_pago, 'Rechazado');
                await this.repos.mensualidades.cambiarEstado(tx, pendiente.id_mensualidad, 'Anulada');
            }

            const ultimaFin = await this.repos.mensualidades.ultimaFechaFin(tx, vehiculo.placa);

            // Renovación: empieza al día siguiente del último vencimiento pagado (o hoy si ya venció)
            const siguiente = ultimaFin ? Mensualidad.sumarDias(ultimaFin, 1) : hoy;
            const fecha_inicio = siguiente > hoy ? siguiente : hoy;
            const fecha_fin = Mensualidad.sumarDias(fecha_inicio, tarifas.DIAS_POR_MENSUALIDAD * n - 1);
            const valor = tarifas.VALOR[vehiculo.tipo] * n;

            const id_mensualidad = await this.repos.mensualidades.crear(tx,
                { placa: vehiculo.placa, fecha_inicio, fecha_fin, valor });
            const referencia_externa = Pago.generarReferencia();
            const id_pago = await this.repos.pagos.crear(tx,
                { id_mensualidad, monto: valor, metodo_pago, referencia_externa });

            return { mensaje: 'Mensualidad creada. Pendiente de confirmación por el Sistema de Pago.',
                     id_mensualidad, id_pago, referencia_externa, placa: vehiculo.placa,
                     fecha_inicio, fecha_fin, monto: valor, estado_pago: 'Pendiente' };
        });
    }

    // ---- Iteración 3: consulta administrativa e historial de pagos ------------
    async consultarPagos({ estado, placa, desde, hasta, pagina = 1, limite = 20 } = {}) {
        const estados = ['Pendiente', 'Aprobado', 'Rechazado'];
        if (estado && !estados.includes(estado)) {
            throw new DomainError('FILTRO_INVALIDO', 'El estado del pago no es válido.', 400);
        }
        const placaNormalizada = placa ? Vehiculo.normalizarPlaca(placa) : '';
        if (placaNormalizada && !/^[A-Z0-9]{5,7}$/.test(placaNormalizada)) {
            throw new DomainError('PLACA_INVALIDA', 'La placa no tiene un formato válido.', 400);
        }
        for (const [nombre, fecha] of [['desde', desde], ['hasta', hasta]]) {
            if (fecha) {
                const formato = /^\d{4}-\d{2}-\d{2}$/.test(fecha);
                const fechaValida = formato && !Number.isNaN(Date.parse(`${fecha}T00:00:00Z`)) &&
                    new Date(`${fecha}T00:00:00Z`).toISOString().slice(0, 10) === fecha;
                if (!fechaValida) throw new DomainError('FILTRO_INVALIDO',
                    `La fecha ${nombre} debe ser una fecha real con formato AAAA-MM-DD.`, 400);
            }
        }
        if (desde && hasta && desde > hasta) {
            throw new DomainError('FILTRO_INVALIDO', 'La fecha inicial no puede ser posterior a la fecha final.', 400);
        }
        const pag = Number(pagina), lim = Number(limite);
        if (!Number.isInteger(pag) || pag < 1 || !Number.isInteger(lim) || lim < 1 || lim > 100) {
            throw new DomainError('PAGINACION_INVALIDA', 'La página debe ser positiva y el límite estar entre 1 y 100.', 400);
        }
        const resultado = await this.repos.pagos.listar(this.pool,
            { estado, placa: placaNormalizada, desde, hasta, pagina: pag, limite: lim });
        const resumen = await this.pool.query(
            `SELECT COUNT(*) FILTER (WHERE estado_pago = 'Aprobado')::int AS aprobados,
                    COUNT(*) FILTER (WHERE estado_pago = 'Pendiente')::int AS pendientes,
                    COUNT(*) FILTER (WHERE estado_pago = 'Rechazado')::int AS rechazados,
                    COALESCE(SUM(monto) FILTER (WHERE estado_pago = 'Aprobado'), 0)::numeric(12,2) AS total_recaudado
             FROM Pago`);
        return { ...resultado, resumen: resumen.rows[0] };
    }

    // Lo invoca el Sistema de Pago externo (callback / webhook)
    async confirmarPago({ referencia_externa, estado }) {
        if (!['Aprobado', 'Rechazado'].includes(estado)) {
            throw new DomainError('ESTADO_INVALIDO', "El estado debe ser 'Aprobado' o 'Rechazado'.", 400);
        }
        return this.enTransaccion(async (tx) => {
            const pago = await this.repos.pagos.buscarPorReferencia(tx, referencia_externa, { bloquear: true });
            if (!pago) throw new DomainError('PAGO_NO_ENCONTRADO', 'No existe un pago con esa referencia.', 404);
            if (!pago.estaPendiente()) {
                throw new DomainError('PAGO_YA_PROCESADO', `El pago ya fue ${pago.estado_pago.toLowerCase()}.`, 409);
            }
            await this.repos.pagos.cambiarEstado(tx, pago.id_pago, estado);
            await this.repos.mensualidades.cambiarEstado(tx, pago.id_mensualidad,
                estado === 'Aprobado' ? 'Pagada' : 'Anulada');
            return { mensaje: `Pago ${estado.toLowerCase()}.`, id_pago: pago.id_pago,
                     id_mensualidad: pago.id_mensualidad, estado_pago: estado };
        });
    }
}

module.exports = ControlOperaciones;
