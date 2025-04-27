import fs from 'fs';
import exifr from 'exifr';
import { logger } from './log.js';

export const analizar = async (rutaArchivo) => {
    const resultado = {
        nombreAnalizador: "VALIDADOR_DE_IMÁGENES",
        descripcion: "Valida la integridad de la imagen y extrae sus principales características, como formato, dimensiones y metadatos EXIF.",
        score: null,
        detalles: {
            formato: "No disponible",
            dimensiones: "No disponible",
            resolucion: "No disponible",
            mensaje: "Análisis no procesado correctamente."
        },
        metadatos: {}, // Metadatos relevantes
        logs: []
    };

    try {
        // Validar existencia del archivo
        if (!fs.existsSync(rutaArchivo)) throw new Error("El archivo no existe.");
        logger.info("Archivo validado.");
        resultado.logs.push("Archivo validado.");

        // Extraer metadatos usando exifr
        const metadatosCompletos = await exifr.parse(rutaArchivo) || {};
        logger.info("Metadatos EXIF extraídos correctamente.");
        resultado.logs.push("Metadatos EXIF extraídos correctamente.");

        // Procesar metadatos relevantes
        const metadatosRelevantes = {};
        if (metadatosCompletos.Make) metadatosRelevantes.Cámara = metadatosCompletos.Make;
        if (metadatosCompletos.Model) metadatosRelevantes.Modelo = metadatosCompletos.Model;
        if (metadatosCompletos.DateTimeOriginal) metadatosRelevantes.FechaDeCaptura = metadatosCompletos.DateTimeOriginal;
        if (metadatosCompletos.Software) metadatosRelevantes.Software = metadatosCompletos.Software;

        // Asignar detalles básicos
        resultado.detalles.formato = rutaArchivo.split('.').pop().toUpperCase();
        resultado.detalles.dimensiones = metadatosCompletos.ImageWidth && metadatosCompletos.ImageHeight
            ? `${metadatosCompletos.ImageWidth}x${metadatosCompletos.ImageHeight}`
            : "No disponible";
        resultado.detalles.resolucion = metadatosCompletos.XResolution
            ? `${metadatosCompletos.XResolution} ppi`
            : "No disponible";

        // Construir metadatos finales combinados
        resultado.metadatos = {
            Formato: resultado.detalles.formato || "No disponible",
            Dimensiones: resultado.detalles.dimensiones || "No disponible",
            Resolución: resultado.detalles.resolucion || "No disponible",
            ...metadatosRelevantes
        };

        // Registrar metadatos clave de manera limpia
        const logMetadatos = Object.entries(resultado.metadatos)
            .map(([clave, valor]) => `${clave}: ${valor}`)
            .join(', ');
        logger.info(`Metadatos procesados: ${logMetadatos}`);

        // Calcular puntaje basado en software sospechoso
        const sospechoso = metadatosCompletos.Software && ["MidJourney", "DALL-E", "Stable Diffusion"].some(tool =>
            metadatosCompletos.Software.includes(tool)
        );
        resultado.score = sospechoso ? 3 : 8;

        // Añadir mensaje al resultado
        resultado.detalles.mensaje = sospechoso
            ? "Sospechoso de ser generado por herramientas de inteligencia artificial."
            : "La imagen parece ser auténtica con datos consistentes.";
    } catch (error) {
        resultado.score = null;
        resultado.detalles.mensaje = `Error durante el análisis: ${error.message}`;
        resultado.logs.push(`Error: ${error.message}`);
        logger.error(`Error durante el análisis: ${error.message}`);
    }

    return resultado;
};
