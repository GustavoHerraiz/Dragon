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

        // Inicializar análisis avanzado con límites refinados
        let bordesInconsistentes = false;
        let texturasInconsistentes = false;
        let desbalanceColores = false;
        let patronesRepetitivosIA = false;

        // Detectar bordes inconsistentes (ajuste: mayor tolerancia)
        for (let i = 0; i < pixelData.length - channels; i += channels) {
            if (Math.abs(pixelData[i] - pixelData[i + channels]) > 100) { // Ajuste: límite incrementado
                bordesInconsistentes = true;
                break;
            }
        }

        // Detectar texturas inconsistentes (ajuste: menor sensibilidad)
        const region1 = pixelData.slice(0, pixelData.length / 2); // Primera mitad
        const region2 = pixelData.slice(pixelData.length / 2); // Segunda mitad
        const diferenciaMedia = Math.abs(
            region1.reduce((a, b) => a + b, 0) / region1.length -
            region2.reduce((a, b) => a + b, 0) / region2.length
        );
        if (diferenciaMedia > 25) { // Ajuste: límite aumentado
            texturasInconsistentes = true;
        }

        // Detectar desbalance de colores (ajuste: mayor tolerancia)
        const histograma = new Array(256).fill(0);
        for (let i = 0; i < pixelData.length; i += channels) {
            histograma[pixelData[i]]++;
        }
        const maximo = Math.max(...histograma);
        const minimo = Math.min(...histograma);
        if (maximo / minimo > 30) { // Ajuste: límite aumentado
            desbalanceColores = true;
        }

        // Detectar patrones repetitivos de IA (ajuste: menor sensibilidad)
        const repeticiones = histograma.filter((v) => v > (width * height) * 0.03).length; // Ajuste: tolerancia aumentada
        if (repeticiones > 80) {
            patronesRepetitivosIA = true;
        }

        // Aplicar la lógica PRM para calcular el score
        const pesos = {
            bordes: 0.2, 
            texturas: 0.25,
            colores: 0.2,
            patronesIA: 0.35 
        };

        const calcularScore = () => {
            const P = 
                (pesos.bordes * (bordesInconsistentes ? 0 : 1)) +
                (pesos.texturas * (texturasInconsistentes ? 0 : 1)) +
                (pesos.colores * (desbalanceColores ? 0 : 1)) +
                (pesos.patronesIA * (patronesRepetitivosIA ? 0 : 1));
            return P * 10; // Escalar el score
        };

        resultado.score = Math.max(0, parseFloat(calcularScore().toFixed(1))); // Garantizar rango 0-10

        // Agregar metadatos relevantes
        resultado.metadatos = {
            Dimensiones: `${width}x${height}`,
            ProfundidadDeBits: channels * 8 || "No disponible",
            Artefactos: bordesInconsistentes || texturasInconsistentes || desbalanceColores || patronesRepetitivosIA
                ? "Presencia detectada"
                : "No se detectaron artefactos"
        };

        // Mensaje detallado con explicación
        resultado.detalles.fotomontajeDetectado = bordesInconsistentes || texturasInconsistentes || desbalanceColores ? "Sí" : "No";
        resultado.detalles.generacionIADetectada = patronesRepetitivosIA ? "Sí" : "No";
        resultado.detalles.tipoArtefactos = [
            bordesInconsistentes && "Bordes inconsistentes",
            texturasInconsistentes && "Texturas inconsistentes",
            desbalanceColores && "Desbalance de colores",
            patronesRepetitivosIA && "Patrones repetitivos sospechosos"
        ].filter(Boolean).join(", ") || "Sin artefactos significativos";
        resultado.detalles.mensaje = resultado.score < 3
            ? `La imagen presenta múltiples indicios claros de manipulación: ${resultado.detalles.tipoArtefactos}.`
            : resultado.score < 7
                ? `La imagen muestra algunos artefactos, pero no definitivos: ${resultado.detalles.tipoArtefactos}.`
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
