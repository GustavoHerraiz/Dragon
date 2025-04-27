'use strict';

import { FibonacciAureoSeal } from './FibonacciAureoSeal.js';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import winston from 'winston';
import { performance } from 'perf_hooks';
import { detectarEspiral, extraerDatosCentrales } from './helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ 
            filename: 'dragon-test.log',
            maxsize: 5242880,
            maxFiles: 5
        })
    ]
});

async function detectarSello(imagenBuffer) {
    const tiempoInicio = performance.now();
    logger.debug('detectarSello - Inicio');

    try {
        const espiralDetectada = await detectarEspiral(imagenBuffer);
        if (!espiralDetectada) {
            return { encontrado: false, error: "Espiral no detectada" };
        }

        const datosCentrales = await extraerDatosCentrales(imagenBuffer, espiralDetectada.centro);
        const tiempoTotal = performance.now() - tiempoInicio;

        return {
            encontrado: true,
            id: datosCentrales,
            autor: datosCentrales,
            datosCentralesDetectados: true,
            tiempoDeteccion: tiempoTotal
        };
    } catch (error) {
        logger.error('Error en detección:', { error: error.message });
        return { encontrado: false, error: error.message };
    }
}

async function ejecutarTest() {
    const metricas = {
        tiempos: {},
        tamanos: {},
        validaciones: {}
    };

    try {
        const imagenOriginalPath = path.join(__dirname, 'original.jpg');
        const imagenSelladaPath = path.join(__dirname, 'original_sellada.jpg');
        const autor = 'GustavoHerraiz';
        const tiempoInicio = performance.now();

        // 1. VALIDACIÓN INICIAL
        logger.info('Iniciando test de sellado MBH');
        const statsOriginal = await fs.stat(imagenOriginalPath);
        metricas.tamanos.original = statsOriginal.size;

        const imagenOriginal = sharp(imagenOriginalPath);
        const metadatosOriginales = await imagenOriginal.metadata();
        
        logger.info('Metadatos imagen original:', {
            dimensiones: `${metadatosOriginales.width}x${metadatosOriginales.height}`,
            formato: metadatosOriginales.format,
            exif: !!metadatosOriginales.exif,
            icc: !!metadatosOriginales.icc,
            iptc: !!metadatosOriginales.iptc,
            xmp: !!metadatosOriginales.xmp,
            density: metadatosOriginales.density
        });

        // 2. CREACIÓN DEL SELLO
        logger.info('Iniciando la creación del sello...');
        const tiempoInicioCreacion = performance.now();
        
        const resultadoSello = await FibonacciAureoSeal.crearSelloMBH(imagenOriginalPath, {
            autor,
            formato: 'jpg',
            dimensiones: {
                ancho: metadatosOriginales.width,
                alto: metadatosOriginales.height
            }
        });

        metricas.tiempos.creacion = performance.now() - tiempoInicioCreacion;
        metricas.validaciones.creacionSello = !!resultadoSello.selloId;

        // 3. GUARDADO
        logger.info('Iniciando el guardado de la imagen sellada...');
        const tiempoInicioGuardado = performance.now();

        await sharp(resultadoSello.imagen)
            .withMetadata()
            .jpeg({
                quality: 100,
                chromaSubsampling: '4:4:4',
                mozjpeg: false,
                force: true,
                optimizeScans: false,
                adaptiveFiltering: true
            })
            .toFile(imagenSelladaPath);

        metricas.tiempos.guardado = performance.now() - tiempoInicioGuardado;

        // 4. DETECCIÓN (CRÍTICA)
        logger.info('Iniciando la detección del sello...');
        const tiempoInicioDeteccion = performance.now();
        const imagenFinal = await fs.readFile(imagenSelladaPath);
        const resultadoDeteccion = await detectarSello(imagenFinal);
        
        metricas.tiempos.deteccion = performance.now() - tiempoInicioDeteccion;
        metricas.validaciones.deteccionSello = resultadoDeteccion.encontrado;
        metricas.validaciones.datosCentrales = resultadoDeteccion.datosCentralesDetectados;

        // 5. VERIFICACIÓN FINAL
        const metadatosFinales = await sharp(imagenSelladaPath).metadata();
        const tamanoFinal = (await fs.stat(imagenSelladaPath)).size;
        metricas.tamanos.final = tamanoFinal;
        metricas.tamanos.diferencia = tamanoFinal - metricas.tamanos.original;

        // Validaciones completas
        metricas.validaciones.formato = ['jpg', 'jpeg'].includes(metadatosFinales.format.toLowerCase());
        metricas.validaciones.tamano = tamanoFinal >= metricas.tamanos.original;
        metricas.validaciones.metadatos = 
            !!metadatosFinales.exif === !!metadatosOriginales.exif &&
            !!metadatosFinales.icc === !!metadatosOriginales.icc &&
            !!metadatosFinales.iptc === !!metadatosOriginales.iptc &&
            !!metadatosFinales.xmp === !!metadatosOriginales.xmp &&
            metadatosFinales.density === metadatosOriginales.density;

        // Resultados finales
        const resultados = {
            sello: {
                creacion: {
                    exitoso: metricas.validaciones.creacionSello,
                    id: resultadoSello.selloId,
                    tiempo: metricas.tiempos.creacion.toFixed(2)
                },
                deteccion: {
                    exitoso: metricas.validaciones.deteccionSello,
                    datosCentrales: metricas.validaciones.datosCentrales,
                    tiempo: metricas.tiempos.deteccion.toFixed(2)
                }
            },
            metadatos: {
                originales: {
                    formato: metadatosOriginales.format,
                    exif: !!metadatosOriginales.exif,
                    icc: !!metadatosOriginales.icc,
                    iptc: !!metadatosOriginales.iptc,
                    xmp: !!metadatosOriginales.xmp,
                    density: metadatosOriginales.density
                },
                finales: {
                    formato: metadatosFinales.format,
                    exif: !!metadatosFinales.exif,
                    icc: !!metadatosFinales.icc,
                    iptc: !!metadatosFinales.iptc,
                    xmp: !!metadatosFinales.xmp,
                    density: metadatosFinales.density
                }
            },
            tamanos: {
                original: metricas.tamanos.original,
                final: metricas.tamanos.final,
                diferencia: metricas.tamanos.diferencia
            },
            tiempos: {
                creacion: metricas.tiempos.creacion.toFixed(2),
                guardado: metricas.tiempos.guardado.toFixed(2),
                deteccion: metricas.tiempos.deteccion.toFixed(2),
                total: (performance.now() - tiempoInicio).toFixed(2)
            }
        };

        logger.info('Test completado', resultados);

        // Verificar fallos
        const fallos = Object.entries(metricas.validaciones)
            .filter(([, valor]) => !valor)
            .map(([key]) => key);

        if (fallos.length > 0) {
            throw new Error(`Test fallido en: ${fallos.join(', ')}`);
        }

        // Verificar P95
        const tiemposExcedidos = Object.entries(metricas.tiempos)
            .filter(([, tiempo]) => tiempo > 200)
            .map(([proceso]) => proceso);

        if (tiemposExcedidos.length > 0) {
            logger.warn('P95 excedido en:', { procesos: tiemposExcedidos });
        }

        return resultados;

    } catch (error) {
        logger.error('Error en test:', {
            mensaje: error.message,
            stack: error.stack
        });
        throw error;
    }
}

// Ejecución única
ejecutarTest()
    .then(() => process.exit(0))
    .catch(error => {
        logger.error('Error fatal en test:', { error: error.message });
        process.exit(1);
    });