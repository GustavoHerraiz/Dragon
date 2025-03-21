import fs from 'fs';
import sharp from 'sharp'; // Procesamiento avanzado de imágenes
import pkg from 'fft.js'; // Importar como módulo CommonJS
const { FFT } = pkg; // Extraer la clase FFT

import { logger } from './log.js';

export const analizar = async (rutaArchivo) => {
    const resultado = {
        nombreAnalizador: "ANÁLISIS_FFT",
        descripcion: "Realiza un análisis espectral mediante transformadas de Fourier (FFT) para identificar patrones periódicos o repetitivos en la imagen.",
        score: null,
        detalles: {
            patronesDetectados: "No disponible",
            picosFrecuenciales: "No disponible",
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

        // Procesar imagen con sharp
        const imagen = sharp(rutaArchivo).greyscale();
        const { width, height } = await imagen.metadata();
        if (!width || !height || width <= 0 || height <= 0) {
            throw new Error("Dimensiones inválidas: las dimensiones deben ser mayores a 0.");
        }
        logger.info(`Dimensiones procesadas: ${width}x${height}`);
        resultado.logs.push(`Dimensiones procesadas: ${width}x${height}`);

        // Obtener datos en bruto de la imagen
        const rawBuffer = await imagen.raw().toBuffer();
        if (!rawBuffer || rawBuffer.length < width * height) {
            throw new Error(
                `Buffer inválido. Tamaño esperado: ${width * height}, Tamaño recibido: ${rawBuffer.length}`
            );
        }
        logger.info(`Buffer obtenido correctamente. Tamaño: ${rawBuffer.length}`);
        resultado.logs.push(`Buffer obtenido correctamente. Tamaño: ${rawBuffer.length}`);

        // Preparar datos para FFT (convertir en líneas horizontales promediadas)
        const filasPromedio = [];
        for (let i = 0; i < height; i++) {
            const filaInicio = i * width;
            const filaFin = filaInicio + width;

            if (filaFin > rawBuffer.length) {
                throw new Error(
                    `Índice de fila fuera de límites. Fila inicio: ${filaInicio}, Fila fin: ${filaFin}, Tamaño del buffer: ${rawBuffer.length}`
                );
            }

            const fila = rawBuffer.slice(filaInicio, filaFin);
            if (!fila || fila.length === 0) throw new Error(`Fila ${i} vacía o inválida.`);

            const promedio = fila.reduce((a, b) => a + b, 0) / fila.length;
            if (isNaN(promedio) || promedio === undefined) {
                throw new Error(`Promedio inválido generado en la fila ${i}.`);
            }
            filasPromedio.push(promedio);
        }
        logger.info(`Promedios generados: ${filasPromedio.slice(0, 10)}`);
        resultado.logs.push("Datos preparados para FFT correctamente.");

        if (!Array.isArray(filasPromedio) || filasPromedio.length === 0) {
            throw new Error("Datos inválidos para FFT.");
        }

        // Aplicar FFT con fft.js
        const fftSize = filasPromedio.length;
        const fft = new FFT(fftSize);
        const real = new Float32Array(fftSize);
        const imag = new Float32Array(fftSize);

        filasPromedio.forEach((val, i) => {
            real[i] = val;
        });

        fft.transform(real, imag);
        logger.info("FFT transformada aplicada correctamente.");

        // Calcular magnitudes
        const magnitudes = Array.from({ length: fftSize }, (_, i) =>
            Math.sqrt(real[i] ** 2 + imag[i] ** 2)
        );
        if (!magnitudes || magnitudes.length === 0) {
            throw new Error("Magnitudes FFT vacías o inválidas.");
        }
        logger.info(`FFT magnitudes calculadas correctamente. Longitud: ${magnitudes.length}`);

        // Detectar picos frecuenciales significativos
        const picosFrecuenciales = magnitudes.filter((mag) => mag > 20); // Umbral ajustable
        resultado.detalles.picosFrecuenciales = picosFrecuenciales.length;

        const patronesDetectados = picosFrecuenciales.length > 5;
        resultado.detalles.patronesDetectados = patronesDetectados ? "Sí" : "No";

        resultado.metadatos = {
            Dimensiones: `${width}x${height}`,
            FrecuenciasSospechosas: picosFrecuenciales.length,
            Artefactos: patronesDetectados ? "Presencia confirmada" : "Ninguno detectado",
        };

        resultado.score = patronesDetectados ? 5 : 9;

        resultado.detalles.mensaje = patronesDetectados
            ? `Se detectaron ${picosFrecuenciales.length} patrones repetitivos en el espectro de frecuencias.`
            : "No se detectaron patrones sospechosos.";
        resultado.logs.push("Transformada de Fourier completada.");
    } catch (error) {
        resultado.score = null;
        resultado.detalles.mensaje = `Error durante el análisis: ${error.message}`;
        resultado.logs.push(`Error: ${error.message}`);
        logger.error(`Error durante el análisis: ${error.message}`);
    }

    return resultado;
};
