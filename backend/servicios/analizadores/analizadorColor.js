import fs from 'fs';
import sharp from 'sharp';
import { logger } from '../redSuperior/utils/logger.js';
import exifr from 'exifr';
import { redis } from '../../server.js';

const TIMEOUT_MS = process.env.ANALIZADOR_TIMEOUT_MS || 3000;
const MAX_IMAGE_SIZE = process.env.MAX_IMAGE_SIZE || 15 * 1024 * 1024;

function calculateStdDev(min, max, sum, pixels) {
    const std = (max - min) / 4;
    return std;
}

export const analizar = async (rutaArchivo) => {
    const startTime = process.hrtime();
    
    const resultado = {
        nombreAnalizador: "ANÁLISIS_DE_COLOR",
        descripcion: "Analiza la composición de colores en la imagen",
        score: null,
        detalles: {
            coloresDominantes: "No disponible",
            balanceColor: "No disponible",
            variacionColor: null,
            mensaje: "Análisis no procesado correctamente."
        },
        metadatos: {},
        logs: []
    };

    try {
        // 1. Validación de archivo (mantenemos timeout)
        const validacionPromise = new Promise((resolve, reject) => {
            if (!fs.existsSync(rutaArchivo)) {
                reject(new Error("El archivo no existe."));
                return;
            }
            
            const stats = fs.statSync(rutaArchivo);
            if (stats.size > MAX_IMAGE_SIZE) {
                logger.warn("Archivo excede tamaño recomendado", {
                    size: stats.size,
                    maxSize: MAX_IMAGE_SIZE
                });
            }
            
            resolve();
        });

        await Promise.race([
            validacionPromise,
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout en validación')), TIMEOUT_MS)
            )
        ]);

        // 2. Análisis mejorado de imagen
        const imagen = sharp(rutaArchivo).toColorspace('srgb');
        const [metadata, stats] = await Promise.all([
            imagen.metadata(),
            imagen.stats()
        ]);

        if (!stats.channels || stats.channels.length < 3) {
            throw new Error(`Canales RGB inválidos: ${stats.channels?.length || 0}`);
        }

        // 3. Cálculo mejorado de variación de color
        const pixels = metadata.width * metadata.height;
        const stdDevs = stats.channels.map(channel => 
            calculateStdDev(channel.min, channel.max, channel.sum, pixels)
        );

        const variacionColor = Math.sqrt(
            stdDevs.reduce((sum, std) => sum + std * std, 0)
        );

        // 4. Score basado en variación (0-10)
        resultado.score = Math.min(10, Math.round((variacionColor / 128) * 10));
        
        // 5. Detalles actualizados
        resultado.detalles = {
            coloresDominantes: `RGB(${stats.channels[0].mean}, ${stats.channels[1].mean}, ${stats.channels[2].mean})`,
            balanceColor: variacionColor > 60 ? "Colores variados" : "Colores uniformes",
            variacionColor: variacionColor.toFixed(2),
            mensaje: resultado.score >= 8
                ? "Alta variación cromática, imagen rica en contraste."
                : resultado.score >= 6
                    ? "Variación cromática moderada, imagen balanceada."
                    : "Baja variación cromática, imagen uniforme."
        };

        // 6. Logging mejorado
const [seconds, nanoseconds] = process.hrtime(startTime);
const tiempoMS = (seconds * 1000 + nanoseconds / 1e6).toFixed(2);

// PULSO A REDIS
redis.publish('dragon:pulse', JSON.stringify({
    ts: new Date().toISOString().slice(0,19).replace('T',' '),
    comp: 'color',
    t: tiempoMS
}));

        logger.info("Análisis completado", {
            tiempoMS,
            rutaArchivo,
            score: resultado.score,
            variacionColor,
            channelStats: {
                r: { std: stdDevs[0], min: stats.channels[0].min, max: stats.channels[0].max },
                g: { std: stdDevs[1], min: stats.channels[1].min, max: stats.channels[1].max },
                b: { std: stdDevs[2], min: stats.channels[2].min, max: stats.channels[2].max }
            }
        });

        resultado.logs.push("Análisis de colores completado exitosamente.");

    } catch (error) {
        logger.error("Error en análisis de color", {
            error: error.message,
            stack: error.stack,
            rutaArchivo
        });
        
        resultado.score = null;
        resultado.detalles.mensaje = `Error durante el análisis: ${error.message}`;
        resultado.logs.push(`Error: ${error.message}`);
    }

    return resultado;
};

export default {
    analizar
};
