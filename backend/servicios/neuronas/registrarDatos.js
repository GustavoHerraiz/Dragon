import fs from 'fs';

export function registrarResultado(nombreRed, datos) {
    const archivo = 'datosRedes.json'; // Archivo centralizado
    let registros;

    // Leer el archivo, o crear uno vacío si no existe
    try {
        if (fs.existsSync(archivo)) {
            const contenido = fs.readFileSync(archivo, 'utf-8');
            registros = JSON.parse(contenido);
        } else {
            registros = [];
        }
    } catch (error) {
        console.error('Error al leer el archivo:', error);
        registros = [];
    }

    // Añadir un nuevo registro
    const nuevoRegistro = {
        nombreRed,
        fecha: new Date().toISOString(),
        datos
    };
    registros.push(nuevoRegistro);

    // Guardar los registros actualizados
    try {
        fs.writeFileSync(archivo, JSON.stringify(registros, null, 2));
        console.log('Registro actualizado correctamente.');
    } catch (error) {
        console.error('Error al guardar el archivo:', error);
    }
}
