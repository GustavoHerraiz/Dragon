import fs from 'fs';
import exifr from 'exifr'; // Para analizar metadatos EXIF
import { logger } from './log.js';

export const analizar = async (rutaArchivo) => {
    const resultado = {
        nombreAnalizador: "FIRMAS_DIGITALES",
        descripcion: "Identifica firmas digitales o rastros en los metadatos que puedan indicar si la imagen ha sido manipulada, autenticada o generada por software específico.",
        score: null,
        detalles: {
            tipoFirma: "No disponible",
            softwareDetectado: "No disponible",
            mensaje: "Análisis no procesado correctamente."
        },
        metadatos: {}, // Metadatos relevantes para firmas digitales
        logs: []
    };

    try {
        // Validar la existencia del archivo
        if (!fs.existsSync(rutaArchivo)) throw new Error("El archivo no existe.");
        logger.info("Archivo validado.");
        resultado.logs.push("Archivo validado.");

        // Extraer metadatos EXIF usando exifr
        const metadatosCompletos = await exifr.parse(rutaArchivo) || {};
        logger.info("Metadatos EXIF extraídos correctamente.");
        resultado.logs.push("Metadatos EXIF extraídos correctamente.");

        // Listas de software
        const softwareEdicion = [
            "Adobe Photoshop", "Adobe Lightroom", "GIMP",
            "CorelDRAW", "Paint.NET", "Affinity Photo",
            "Krita", "Pixelmator", "Canva", "Procreate"
        ];
        const softwareGeneracionIA = [
            "MidJourney", "Stable Diffusion", "DALL-E",
            "Craiyon", "Artbreeder", "DeepArt"
        ];

        const softwareDetectado = metadatosCompletos.Software || "No disponible";
        let tipoFirma = "Sin firma detectable";

        // Determinar tipo de firma detectada
        if (softwareEdicion.some(tool => softwareDetectado.includes(tool))) {
            tipoFirma = "Software de edición detectado";
        } else if (softwareGeneracionIA.some(tool => softwareDetectado.includes(tool))) {
            tipoFirma = "Herramienta de generación IA detectada";
        }

        // Asignar detalles
        resultado.detalles.tipoFirma = tipoFirma;
        resultado.detalles.softwareDetectado = softwareDetectado;

        // Asignar metadatos clave
        resultado.metadatos = {
            Software: softwareDetectado,
            MarcaCámara: metadatosCompletos.Make || "No disponible",
            ModeloCámara: metadatosCompletos.Model || "No disponible"
        };

        resultado.logs.push("Análisis de firmas digitales completado.");

        // Ajustar puntuación
        if (tipoFirma === "Software de edición detectado") {
            resultado.score = 7; // Penalización leve por edición
        } else if (tipoFirma === "Herramienta de generación IA detectada") {
            resultado.score = 4; // Penalización más severa por generación IA
        } else {
            resultado.score = 9; // Alta puntuación si no hay firmas sospechosas
        }

        // Mensajes detallados
        resultado.detalles.mensaje =
            tipoFirma === "Software de edición detectado"
                ? "Se detectó un software de edición en los metadatos. Esto podría indicar una modificación sin generar una imagen artificial."
                : tipoFirma === "Herramienta de generación IA detectada"
                ? "Se detectó una herramienta de generación por IA en los metadatos, lo que podría indicar creación artificial."
                : "No se detectaron firmas digitales sospechosas. La imagen parece auténtica.";
    } catch (error) {
        resultado.score = null;
        resultado.detalles.mensaje = `Error durante el análisis: ${error.message}`;
        resultado.logs.push(`Error: ${error.message}`);
        logger.error(`Error durante el análisis: ${error.message}`);
    }

    return resultado;
};
