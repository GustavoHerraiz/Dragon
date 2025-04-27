import fs from 'fs';
import sharp from 'sharp';
import { logger } from './log.js';

const calcularNitidez = async (rutaArchivo) => {
    const image = sharp(rutaArchivo).greyscale();
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

    let sumGradient = 0;
    const width = info.width;

    for (let i = 0; i < data.length - width; i++) {
        const diff = data[i] - data[i + width];
        sumGradient += Math.abs(diff);
    }

    const gradientePromedio = sumGradient / data.length;
    return gradientePromedio;
};

export const analizar = async (rutaArchivo) => {
    const resultado = {
        nombreAnalizador: "ANÁLISIS_DE_DEFINICIÓN",
        descripcion: "Evalúa la definición y nitidez de la imagen calculando gradientes y bordes, características que pueden indicar calidad o manipulación.",
        score: null,
        detalles: {
            nitidez: "No disponible",
            gradientePromedio: "No disponible",
            mensaje: "Análisis no procesado correctamente.",
            evaluacion: "No disponible"
        },
        metadatos: "Metadatos no disponibles",
        logs: []
    };

    try {
        if (!fs.existsSync(rutaArchivo)) throw new Error("El archivo no existe.");
        logger.info("Archivo validado.");
        resultado.logs.push("Archivo validado.");

        const gradientePromedio = await calcularNitidez(rutaArchivo);
        resultado.detalles.gradientePromedio = `${gradientePromedio.toFixed(2)} unidades`;
        logger.info(`Gradiente promedio calculado para la imagen: ${gradientePromedio.toFixed(2)} unidades`);
        resultado.logs.push(`Gradiente promedio: ${gradientePromedio.toFixed(2)} unidades`);

        // Evaluación y lógica ajustada
        resultado.detalles.nitidez = gradientePromedio > 15
            ? "Alta nitidez"
            : gradientePromedio > 8
                ? "Nitidez moderada"
                : "Baja nitidez";

        // Invertimos la puntuación para priorizar lo humano
        resultado.score = gradientePromedio > 15
            ? 7 // Característica IA.
            : gradientePromedio > 8
                ? 8 // Posible equilibrio.
                : 9; // Característica más humana.

        resultado.detalles.evaluacion = resultado.score === 9
            ? "Humano (0)"
            : "IA (1)";

        resultado.detalles.mensaje = resultado.score === 9
            ? "La imagen tiene baja nitidez, una característica común en fotografías humanas reales."
            : resultado.score === 8
                ? "La imagen tiene una nitidez moderada, lo que podría ser un equilibrio entre humano y digital."
                : "La imagen tiene alta nitidez, lo que podría sugerir generación digital.";

        const metadata = await sharp(rutaArchivo).metadata();
        resultado.metadatos = {
            formato: metadata.format || "Desconocido",
            ancho: metadata.width || "No disponible",
            alto: metadata.height || "No disponible",
            densidad: metadata.density || "No disponible"
        };

        logger.info(`Metadatos procesados: Formato: ${metadata.format || "Desconocido"}, Dimensiones: ${metadata.width || "No disponible"}x${metadata.height || "No disponible"}`);
        resultado.logs.push("Metadatos procesados correctamente.");

    } catch (error) {
        resultado.score = null;
        resultado.detalles.mensaje = `Error durante el análisis: ${error.message}`;
        resultado.logs.push(`Error: ${error.message}`);
        logger.error(`Error durante el análisis: ${error.message}`);
    }

    return resultado;
};
