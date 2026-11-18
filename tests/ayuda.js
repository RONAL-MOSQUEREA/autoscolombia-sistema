// Utilidad compartida de pruebas. NUNCA debe operar sobre la base de datos real.
async function exigirBaseDePruebas(pool) {
    const { rows: [r] } = await pool.query('SELECT current_database() AS nombre');
    if (!/(?:_test|_pruebas)$/i.test(r.nombre)) {
        throw new Error(`SEGURIDAD: las pruebas solo pueden ejecutarse en una BD terminada en _test o _pruebas. Conectada: ${r.nombre}`);
    }
}

async function restaurarDatosDePrueba(pool) {
    await exigirBaseDePruebas(pool);
    await pool.query('DELETE FROM Novedad');
    await pool.query('DELETE FROM RegistroAcceso');
    await pool.query('DELETE FROM Pago WHERE id_pago > 3');
    await pool.query('DELETE FROM Mensualidad WHERE id_mensualidad > 3');
    await pool.query("DELETE FROM Vehiculo WHERE placa NOT IN ('ABC123','XYZ987','MNO456','QRS789')");
    await pool.query("DELETE FROM Usuario WHERE documento NOT IN ('1017123456','1020987654','9999999999','8888888888','1030555111','1030555222')");
    await pool.query('DELETE FROM Celda WHERE numero_celda NOT IN (101,102,103,201,202,301)');
    await pool.query(`UPDATE Celda SET estado = 'Disponible',
        tipo = CASE WHEN numero_celda BETWEEN 101 AND 103 THEN 'Automovil' WHEN numero_celda IN (201,202) THEN 'Motocicleta' ELSE 'General' END`);
    await pool.query("UPDATE Usuario SET estado = CASE WHEN documento = '1030555222' THEN 'Inactivo' ELSE 'Activo' END");
    await pool.query("UPDATE Vehiculo SET id_usuario = (SELECT id_usuario FROM Usuario WHERE documento = CASE WHEN placa IN ('ABC123','QRS789') THEN '1017123456' ELSE '1020987654' END)");
    await pool.query(`UPDATE Mensualidad SET fecha_inicio = CURRENT_DATE - 10, fecha_fin = CURRENT_DATE + 19, estado_pago = 'Pagada' WHERE id_mensualidad = 1`);
    await pool.query(`UPDATE Mensualidad SET fecha_inicio = CURRENT_DATE - 35, fecha_fin = CURRENT_DATE - 5, estado_pago = 'Pagada' WHERE id_mensualidad = 2`);
    await pool.query(`UPDATE Mensualidad SET fecha_inicio = CURRENT_DATE - 26, fecha_fin = CURRENT_DATE + 3, estado_pago = 'Pagada' WHERE id_mensualidad = 3`);
}
module.exports = { restaurarDatosDePrueba, exigirBaseDePruebas };
