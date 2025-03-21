import fs from 'fs';
import sharp from 'sharp'; // Procesamiento avanzado de imágenes
import { logger } from './log.js';

export const analizar = async (rutaArchivo) => {
    const resultado = {
        nombreAnalizador: "DETECCIÓN_DE_ARTEFACTOS",
        descripcion: "Identifica artefactos visuales en la imagen, como ruido de compresión, patrones de moiré, píxeles distorsionados o reflejos, que podrían indicar manipulación o generación sintética.",
        score: null,
        detalles: {
            artefactosDetectados: "No disponible",
            tipoArtefactos: "No disponible",
            fotomontajeDetectado: "No",
            generacionIADetectada: "No",
            mensaje: "Análisis no procesado correctamente."
        },
        metadatos: {}, // Metadatos relevantes
        logs: []
    };

    try {
        // Validar la existencia del archivo
        if (!fs.existsSync(rutaArchivo)) throw new Error("El archivo no existe.");
        logger.info("Archivo validado.");
        resultado.logs.push("Archivo validado.");

        // Cargar la imagen
        const imagen = sharp(rutaArchivo);

        // Obtener estadísticas básicas de la imagen
        const { width, height, channels } = await imagen.metadata();
        if (!width || !height) throw new Error("No se pudieron extraer las dimensiones.");
        logger.info(`Metadatos básicos procesados: Dimensiones: ${width}x${height}, Profundidad de Bits: ${channels * 8 || "No disponible"}`);
        resultado.logs.push("Metadatos básicos procesados.");

        const pixelData = await imagen.raw().toBuffer(); // Convertir a datos en bruto

        // Inicializar análisis avanzado
        let bordesInconsistentes = false;
        let texturasInconsistentes = false;
        let desbalanceColores = false;
        let patronesRepetitivosIA = false;

        // Detectar bordes inconsistentes
        for (let i = 0; i < pixelData.length - channels; i += channels) {
            if (Math.abs(pixelData[i] - pixelData[i + channels]) > 80) {
                bordesInconsistentes = true; // Cortes visibles
                break;
            }
        }

        // Detectar texturas inconsistentes
        const region1 = pixelData.slice(0, pixelData.length / 2); // Primera mitad
        const region2 = pixelData.slice(pixelData.length / 2); // Segunda mitad
        const diferenciaMedia = Math.abs(
            region1.reduce((a, b) => a + b, 0) / region1.length -
            region2.reduce((a, b) => a + b, 0) / region2.length
        );
        if (diferenciaMedia > 10) {
            texturasInconsistentes = true;
        }

        // Detectar desbalance de colores
        const histograma = new Array(256).fill(0);
        for (let i = 0; i < pixelData.length; i += channels) {
            histograma[pixelData[i]]++;
        }
        const maximo = Math.max(...histograma);
        const minimo = Math.min(...histograma);
        if (maximo / minimo > 10) {
            desbalanceColores = true;
        }

        // Detectar patrones repetitivos de IA
        const repeticiones = histograma.filter((v) => v > (width * height) * 0.01).length;
        if (repeticiones > 50) {
            patronesRepetitivosIA = true;
        }

        // Determinar resultados
        const fotomontajeDetectado = bordesInconsistentes || texturasInconsistentes || desbalanceColores;
        const generacionIADetectada = patronesRepetitivosIA && !fotomontajeDetectado;

        // Ajustar puntuación
        if (fotomontajeDetectado) {
            resultado.score = 4;
        } else if (generacionIADetectada) {
            resultado.score = 5;
        } else {
            resultado.score = 7;
        }

        // Agregar metadatos relevantes
        resultado.metadatos = {
            Dimensiones: `${width}x${height}`,
            ProfundidadDeBits: channels * 8 || "No disponible",
            Artefactos: fotomontajeDetectado || generacionIADetectada ? "Presencia detectada" : "No se detectaron artefactos"
        };

        // Mensaje detallado con explicación
        resultado.detalles.fotomontajeDetectado = fotomontajeDetectado ? "Sí" : "No";
        resultado.detalles.generacionIADetectada = generacionIADetectada ? "Sí" : "No";
        resultado.detalles.tipoArtefactos = [
            bordesInconsistentes && "Bordes inconsistentes",
            texturasInconsistentes && "Texturas inconsistentes",
            desbalanceColores && "Desbalance de colores",
            patronesRepetitivosIA && "Patrones repetitivos sospechosos"
        ].filter(Boolean).join(", ") || "Sin artefactos significativos";
        resultado.detalles.mensaje = fotomontajeDetectado
            ? `Se detectó un posible fotomontaje debido a: ${resultado.detalles.tipoArtefactos}. Esto indica manipulación avanzada.`
            : generacionIADetectada
                ? `La imagen presenta patrones repetitivos sospechosos indicativos de generación por IA: ${resultado.detalles.tipoArtefactos}.`
                : "La imagen no presenta indicios claros de manipulación ni generación sintética.";

        resultado.logs.push("Análisis de artefactos completado.");
    } catch (error) {
        resultado.score = null;
        resultado.detalles.mensaje = `Error durante el análisis: ${error.message}`;
        resultado.logs.push(`Error: ${error.message}`);
        logger.error(`Error durante el análisis: ${error.message}`);
    }

    return resultado;
};
