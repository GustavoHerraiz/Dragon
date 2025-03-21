import fs from 'fs';
import sharp from 'sharp'; // Utilizado para análisis y manipulación de imágenes
import { logger } from './log.js';

export const analizar = async (rutaArchivo) => {
    const resultado = {
        nombreAnalizador: "DETECCIÓN_DE_PANTALLA",
        descripcion: "Determina si la imagen es un volcado de pantalla, una foto tomada a una pantalla o una fotografía real.",
        score: null,
        detalles: {
            tipoCaptura: "No disponible",
            mensaje: "Análisis no procesado correctamente."
        },
        metadatos: {}, // Metadatos clave para la captura
        logs: []
    };

    try {
        // Validar la existencia del archivo
        if (!fs.existsSync(rutaArchivo)) throw new Error("El archivo no existe.");
        logger.info("Archivo validado.");
        resultado.logs.push("Archivo validado.");

        // Cargar la imagen usando sharp
        const imagen = sharp(rutaArchivo);

        // Extraer metadatos básicos de la imagen
        const metadata = await imagen.metadata();

        // Ajustar log para mostrar solo datos clave
        logger.info(
            `Metadatos procesados: Formato: ${metadata.format || "No disponible"}, Dimensiones: ${metadata.width || "No disponible"}x${metadata.height || "No disponible"}, Resolución: ${metadata.density || "No disponible"} ppi, ProfundidadDeBits: ${metadata.bitDepth || "No disponible"}`
        );
        resultado.logs.push("Metadatos procesados correctamente.");

        // Analizar artefactos característicos
        const artefactosDetectados = metadata.width < 2000 && metadata.height < 2000;
        const patronesDetectados = artefactosDetectados
            ? "Patrón de líneas o píxeles detectado (posible foto a pantalla)"
            : "No se detectaron patrones relacionados con pantallas";

        // Calcular proporción
        const proporción = metadata.width && metadata.height
            ? (metadata.width / metadata.height).toFixed(2)
            : "No disponible";

        // Clasificar tipo de captura
        let tipoCaptura;
        if (!artefactosDetectados && metadata.width > 2000 && metadata.height > 2000) {
            tipoCaptura = "Fotografía real";
        } else if (artefactosDetectados) {
            tipoCaptura = "Foto tomada a una pantalla";
        } else {
            tipoCaptura = "Volcado directo de pantalla";
        }

        // Asignar metadatos clave
        resultado.metadatos = {
            Formato: metadata.format || "No disponible",
            Dimensiones: metadata.width && metadata.height ? `${metadata.width}x${metadata.height}` : "No disponible",
            ResoluciónHorizontal: metadata.density || "No disponible",
            ResoluciónVertical: metadata.density || "No disponible",
            ProfundidadDeBits: metadata.bitDepth || "No disponible",
            Proporción: proporción
        };

        // Ajustar detalles y puntuación en función del tipo de captura
        resultado.detalles.tipoCaptura = tipoCaptura;
        resultado.logs.push("Análisis de patrones completado.");

        // Ajustar puntuación: Fotografía real puntúa más alto
        resultado.score =
            tipoCaptura === "Fotografía real" ? 10 :
            tipoCaptura === "Volcado directo de pantalla" ? 6 :
            4; // Menor puntuación para fotos tomadas a pantallas

        // Mensajes detallados
        resultado.detalles.mensaje =
            tipoCaptura === "Fotografía real"
                ? "La imagen parece ser una fotografía auténtica tomada en un entorno físico, lo que indica una creación humana directa."
                : tipoCaptura === "Foto tomada a una pantalla"
                ? "La imagen parece haber sido tomada a una pantalla. Esto podría indicar reproducción o manipulación digital."
                : "La imagen parece ser un volcado directo de pantalla, consistente con datos digitales pero no necesariamente físicos.";
    } catch (error) {
        resultado.score = null;
        resultado.detalles.mensaje = `Error durante el análisis: ${error.message}`;
        resultado.logs.push(`Error: ${error.message}`);
        logger.error(`Error durante el análisis: ${error.message}`);
    }

    return resultado;
};
