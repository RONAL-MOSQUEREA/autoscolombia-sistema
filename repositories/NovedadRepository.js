exports.crear = async (ex, { placa, id_registro = null, descripcion }) => {
    const { rows } = await ex.query(
        `INSERT INTO Novedad (placa, id_registro, descripcion, fecha_hora)
         VALUES ($1, $2, $3, LOCALTIMESTAMP(0)) RETURNING id_novedad`,
        [placa, id_registro, descripcion]);
    return rows[0].id_novedad;
};

exports.listarPorPlaca = async (ex, placa) => {
    const { rows } = await ex.query(
        'SELECT * FROM Novedad WHERE placa = $1 ORDER BY fecha_hora DESC, id_novedad DESC', [placa]);
    return rows;
};

exports.recientes = async (ex, limite = 10) => {
    const { rows } = await ex.query(
        'SELECT * FROM Novedad ORDER BY fecha_hora DESC, id_novedad DESC LIMIT $1', [limite]);
    return rows;
};
