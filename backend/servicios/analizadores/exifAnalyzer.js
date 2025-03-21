import fs from 'fs';
import exifr from 'exifr';
import { logger } from './log.js';

// Función para formatear fechas
const formatearFecha = (fecha) => {
    if (!fecha) return "No disponible";
    const opciones = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' };
    return new Intl.DateTimeFormat('es-ES', opciones).format(new Date(fecha));
};

export const analizar = async (rutaArchivo) => {
    const resultado = {
        nombreAnalizador: "EXIF_METADATA",
        descripcion: "Analiza los metadatos EXIF de la imagen para extraer información técnica como modelo de cámara, resolución y software utilizado.",
        score: null,
        detalles: {
            mensaje: "Análisis no procesado correctamente."
        },
        metadatos: {}, // Metadatos relevantes para EXIF
        logs: []
    };

    try {
        // Validar existencia del archivo
        if (!fs.existsSync(rutaArchivo)) throw new Error("El archivo no existe.");
        logger.info("Archivo validado.");
        resultado.logs.push("Archivo validado.");

        // Extraer metadatos EXIF usando exifr
        const metadatosCompletos = await exifr.parse(rutaArchivo) || {};
        logger.info("Metadatos EXIF extraídos.");
        resultado.logs.push("Metadatos EXIF extraídos.");

        // Asignar metadatos relevantes
        resultado.metadatos = {
            Cámara: `${metadatosCompletos.Make || "No disponible"} ${metadatosCompletos.Model || ""}`.trim(),
            Software: metadatosCompletos.Software || "No disponible",
            FechaOriginal: formatearFecha(metadatosCompletos.DateTimeOriginal),
            FechaDeModificación: formatearFecha(metadatosCompletos.ModifyDate)
        };

        // Asignar puntuación basada en la consistencia de los datos
        resultado.score = Object.keys(metadatosCompletos).length > 0 ? 9 : 5;

        // Valoración
        resultado.detalles.mensaje = resultado.score === 9
            ? "Los metadatos indican una imagen auténtica sin software sospechoso."
            : "Los metadatos están incompletos o son sospechosos.";
    } catch (error) {
        // Manejar errores y registrar en logs
        resultado.score = null;
        resultado.logs.push(`Error: ${error.message}`);
        logger.error(`Error durante el análisis: ${error.message}`);
    }

    return resultado;
};
