import fs from 'fs';
import exifr from 'exifr';
import { logger } from './log.js';

export const analizar = async (rutaArchivo) => {
    const resultado = {
        nombreAnalizador: "ANÁLISIS_DE_RESOLUCIÓN",
        descripcion: "Analiza la resolución de la imagen, evaluando la calidad y la proporción de píxeles para identificar características que puedan indicar generación sintética o edición.",
        score: null,
        detalles: {
            resolucion: "No disponible",
            proporcion: "No disponible",
            mensaje: "Análisis no procesado correctamente."
        },
        metadatos: {},
        logs: []
    };

    try {
        // Validar la existencia del archivo
        if (!fs.existsSync(rutaArchivo)) throw new Error("El archivo no existe.");
        logger.info("Archivo validado.");
        resultado.logs.push("Archivo validado.");

        // Extraer metadatos usando exifr
        const metadatosCompletos = await exifr.parse(rutaArchivo) || {};
        resultado.logs.push("Metadatos extraídos correctamente.");

        // Extraer dimensiones y resolución
        const ancho = metadatosCompletos.ImageWidth || "No disponible";
        const alto = metadatosCompletos.ImageHeight || "No disponible";
        const resolucionX = metadatosCompletos.XResolution || "No disponible";
        const resolucionY = metadatosCompletos.YResolution || "No disponible";

        // Calcular proporción si las dimensiones están disponibles
        const proporcion =
            ancho !== "No disponible" && alto !== "No disponible"
                ? (ancho / alto).toFixed(2)
                : "No disponible";

        // Clasificar proporción con tolerancia
        let clasificacionProporcion = "No disponible";
        if (proporcion >= 0.99 && proporcion <= 1.01) {
            clasificacionProporcion = "Cuadrada (1:1)";
        } else if (proporcion >= 1.75 && proporcion <= 1.80) {
            clasificacionProporcion = "Panorámica (16:9)";
        } else if (proporcion >= 1.32 && proporcion <= 1.35) {
            clasificacionProporcion = "Clásica (4:3)";
        } else {
            clasificacionProporcion = "Proporción atípica";
        }

        // Asignar metadatos clave
        resultado.detalles.resolucion = `${ancho}x${alto}`;
        resultado.detalles.proporcion = proporcion;
        resultado.metadatos = {
            Dimensiones: `${ancho}x${alto}`,
            ResoluciónHorizontal: `${resolucionX} ppi`,
            ResoluciónVertical: `${resolucionY} ppi`,
            Proporción: proporcion,
            ClasificaciónProporción: clasificacionProporcion,
            Fabricante: metadatosCompletos.Make || "No disponible",
            Modelo: metadatosCompletos.Model || "No disponible"
        };

        // Log básico ajustado
        logger.info(`Dimensiones: ${ancho}x${alto}, Resolución: ${resolucionX}x${resolucionY} ppi, Proporción: ${clasificacionProporcion}, Fabricante: ${metadatosCompletos.Make}, Modelo: ${metadatosCompletos.Model}`);
        resultado.logs.push("Resolución, proporción y metadatos procesados.");

        // Ponderación por parámetros indicativos de creación humana
        let puntosPorParametros = 0;
        if (metadatosCompletos.Make && metadatosCompletos.Model) {
            puntosPorParametros += 2; // Fabricante y modelo presentes
        }
        if (proporcion >= 1.75 && proporcion <= 1.80) {
            puntosPorParametros += 1; // Proporción panorámica
        }
        if (ancho >= 3000 && alto >= 3000) {
            puntosPorParametros += 1; // Resolución muy alta
        }

        // Determinar puntuación basada en combinación de factores
        resultado.score = 6 + puntosPorParametros; // Base de 6, ajustada por parámetros

        // Actualizar mensaje
        resultado.detalles.mensaje = resultado.score > 8
            ? "La imagen tiene una alta resolución y proporción ideal, con metadatos indicativos de creación humana."
            : resultado.score > 6
                ? "La imagen tiene una resolución aceptable y varios parámetros que refuerzan su creación humana."
                : "La imagen tiene baja resolución o parámetros limitados, lo que podría ser indicativo de manipulación o edición.";

    } catch (error) {
        resultado.score = null;
        resultado.detalles.mensaje = `Error durante el análisis: ${error.message}`;
        resultado.logs.push(`Error: ${error.message}`);
        logger.error(`Error durante el análisis: ${error.message}`);
    }

    return resultado;
};
