
'use strict';

import sharp from 'sharp';
import { createHash } from 'crypto';
import winston from 'winston';
import { performance } from 'perf_hooks';
import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';

// Crear equivalentes de __dirname y __filename para ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración del logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/mbh-error.log'),
      level: 'error'
    }),
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/mbh-combined.log')
    })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Parámetros del sello
const GOLDEN_RATIO = 1.618033988749895;
const SALT_SECRET = process.env.MBH_SALT || 'default-development-salt';
const SEAL_SIZE_RATIO = 0.05; // 5% del lado menor de la imagen
const FONT_FAMILY = 'Arial'; // Fuente para los caracteres

/**
 * Crea un sello MBH para una imagen
 * @param {Buffer|string} imagen - Buffer o ruta de la imagen a sellar
 * @param {Object} opciones - Opciones de configuración
 * @returns {Promise<Buffer>} Imagen con el sello aplicado
 */
async function crearSelloMBH(imagen, opciones = {}) {
  const tiempoInicio = performance.now();

  try {
    // Cargar imagen desde ruta o usar buffer directamente
    const imagenBuffer = typeof imagen === 'string'
      ? await fs.readFile(imagen)
      : imagen;

    // Obtener metadatos de la imagen
    const metadata = await sharp(imagenBuffer).metadata();

    // Generar ID único para el sello
    const selloId = generarSelloId();
    const timestamp = Date.now();

    // Crear el sello como una imagen transparente con patrón espiral
    const selloBuffer = await generarImagenSello(
      metadata,
      selloId,
      timestamp,
      opciones
    );

    // Determinar posición óptima para el sello
    const posicion = determinarPosicionSello(metadata, opciones);

    // Aplicar el sello a la imagen original
    const imagenSellada = await aplicarSello(
      imagenBuffer,
      selloBuffer,
      posicion,
      metadata
    );

    const tiempoTotal = Math.round(performance.now() - tiempoInicio);
    logger.info('Sello creado exitosamente', {
      selloId,
      tiempoMs: tiempoTotal,
      dimensiones: `${metadata.width}x${metadata.height}`
    });

    return {
      imagen: imagenSellada,
      selloId,
      timestamp,
      tiempoProcesamientoMs: tiempoTotal,
      detalles: {
        tipoFirma: "Sello MBH Fibonacci-Áureo",
        softwareDetectado: "FibonacciAureo-MBH"
      },
      score: 10
    };
  } catch (error) {
    logger.error('Error al crear sello MBH', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Genera un ID único para el sello
 * @returns {string} ID del sello
 */
function generarSelloId() {
  const ahora = new Date();
  const base = `MBH-${ahora.getUTCFullYear()}${(ahora.getUTCMonth() + 1).toString().padStart(2, '0')}`;
  const aleatorio = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${base}-${aleatorio}`;
}

/**
 * Genera la imagen del sello con el patrón espiral áureo
 * @param {Object} metadata - Metadatos de la imagen original
 * @param {string} id - ID del sello
 * @param {number} timestamp - Timestamp de creación
 * @param {Object} opciones - Opciones de configuración
 * @returns {Promise<Buffer>} Buffer de la imagen del sello
 */
async function generarImagenSello(metadata, id, timestamp, opciones) {
  // Calcular dimensiones del sello
  const menorLado = Math.min(metadata.width, metadata.height);
  const tamanoSello = Math.floor(menorLado * SEAL_SIZE_RATIO);

  // Crear lienzo transparente para el sello
  const svg = crearSVGEspiralAurea(tamanoSello, id, timestamp);

  // Convertir SVG a imagen
  return sharp(Buffer.from(svg))
    .toFormat('png')
    .toBuffer();
}

/**
 * Crea el SVG con la espiral áurea y datos embebidos
 * @param {number} tamano - Tamaño del sello
 * @param {string} id - ID del sello
 * @param {number} timestamp - Timestamp de creación
 * @returns {string} SVG del sello
 */
function crearSVGEspiralAurea(tamano, id, timestamp) {
  const centro = tamano / 2;
  const puntos = calcularPuntosEspiralAurea(centro, tamano);
  const hash = calcularHash(id, timestamp);
  const caracteres = hash.toUpperCase().split(''); // Convertir a mayúsculas

  // Insertar datos en la espiral
  const puntosConDatos = insertarDatosEnPuntos(puntos, id, timestamp, hash);

  // Generar SVG
  let svg = `<svg width="${tamano}" height="${tamano}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="selloGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
  <stop offset="0%" style="stop-color:rgb(255,255,255);stop-opacity:0.01" />
  <stop offset="100%" style="stop-color:rgb(255,255,255);stop-opacity:0" />
</radialGradient>
    </defs>
    <circle cx="${centro}" cy="${centro}" r="${tamano/2}" fill="url(#selloGradient)" />
    ${generarPathsEspiral(puntosConDatos)}`;

  // Dibujar los caracteres individuales
  const numCaracteres = caracteres.length;
  const espacioEntreCaracteres = tamano / (numCaracteres + 1);
  const fontSize = tamano / numCaracteres / 2;
  for (let i = 0; i < numCaracteres; i++) {
    const x = espacioEntreCaracteres * (i + 1);
    const y = centro;
    svg += `<text x="${x}" y="${y}" font-size="${fontSize}" font-family="${FONT_FAMILY}" opacity="0.8" text-anchor="middle" dominant-baseline="central" fill="black">${caracteres[i]}</text>`;
  }

  svg += `</svg>`;
  return svg;
}

/**
 * Calcula los puntos de la espiral áurea
 * @param {number} centro - Centro de la espiral
 * @param {number} tamano - Tamaño del sello
 * @returns {Array} Puntos de la espiral
 */
function calcularPuntosEspiralAurea(centro, tamano) {
  const puntos = [];
  const espiras = 3; // Número de vueltas completas
  const puntosTotal = 21; // Número total de puntos en la espiral
  const radioMax = tamano / 2;

  for (let i = 0; i < puntosTotal; i++) {
    const angulo = (i / puntosTotal) * Math.PI * 2 * espiras;
    const radio = radioMax * (1 - i / puntosTotal);

    const x = centro + radio * Math.cos(angulo * GOLDEN_RATIO);
    const y = centro + radio * Math.sin(angulo * GOLDEN_RATIO);

    puntos.push({ x, y });
  }

  return puntos;
}

/**
 * Inserta datos en los puntos de la espiral
 */
function insertarDatosEnPuntos(puntos, id, timestamp, hash) {
  // Modificar sutilmente los puntos para insertar datos
  const datos = `${id}:${timestamp}`;
  const datosBuffer = Buffer.from(datos, 'utf8');

  return puntos.map((punto, i) => {
    if (i < datosBuffer.length) {
      // Alterar punto según byte correspondiente
      const ajuste = datosBuffer[i] % 4 - 2; // -2 a +1
      return {
        x: punto.x + ajuste * 0.5,
        y: punto.y + ajuste * 0.5
      };
    }
    return punto;
  });
}

/**
 * Genera los paths SVG para la espiral
 */
function generarPathsEspiral(puntos) {
  return puntos.map((punto, i) => {
    if (i === 0) return '';
    const anterior = puntos[i - 1];
    const color = `rgba(255,255,255,0.01)`;
    const grosor = 1 + (i / puntos.length);

    return `<path d="M${anterior.x},${anterior.y} L${punto.x},${punto.y}"
      stroke="${color}" stroke-width="${grosor}" />`;
  }).join('');
}

/**
 * Calcula el hash para verificar la integridad del sello
 */
function calcularHash(id, timestamp) {
  const datos = `${id}:${timestamp}:${SALT_SECRET}`;
  return createHash('sha256').update(datos).digest('hex');
}

/**
 * Determina la posición óptima para el sello
 */
function determinarPosicionSello(metadata, opciones) {
  // Por defecto, el centro de la imagen
  const posicion = {
    x: 0.5,
    y: 0.5
  };

  // Permitir personalización si se especifica
  if (opciones.posicion) {
    if (opciones.posicion.x !== undefined) {
      posicion.x = opciones.posicion.x;
    }
    if (opciones.posicion.y !== undefined) {
      posicion.y = opciones.posicion.y;
    }
  }

  return posicion;
}

/**
 * Aplica el sello a la imagen original
 * @param {Buffer} imagenBuffer - Buffer de la imagen original
 * @param {Buffer} selloBuffer - Buffer del sello
 * @param {Object} posicion - Posición relativa del sello (x,y de 0 a 1)
 * @param {Object} metadata - Metadatos de la imagen original
 * @returns {Promise<Buffer>} Imagen con el sello aplicado
 */
async function aplicarSello(imagenBuffer, selloBuffer, posicion, metadata) {
  try {
    // Obtener dimensiones del sello
    const selloMetadata = await sharp(selloBuffer).metadata();
    const selloWidth = selloMetadata.width;
    const selloHeight = selloMetadata.height;

    // Calcular posición absoluta centrada
    const left = Math.round(metadata.width * posicion.x - selloWidth / 2);
    const top = Math.round(metadata.height * posicion.y - selloHeight / 2);

    // Verificar que las coordenadas sean válidas
    if (isNaN(left) || isNaN(top)) {
      logger.error('Coordenadas inválidas en aplicarSello', {
        posicion,
        metadata: `${metadata.width}x${metadata.height}`,
        sello: `${selloWidth}x${selloHeight}`,
        calculado: `left=${left}, top=${top}`
      });
      throw new Error('Coordenadas de sello inválidas');
    }

    logger.debug('Aplicando sello', {
      posicionRelativa: posicion,
      posicionAbsoluta: { left, top },
      dimensionesSello: `${selloWidth}x${selloHeight}`
    });

    // CORRECCIÓN: Preservar metadatos al aplicar el sello
    return await sharp(imagenBuffer)
      .composite([{
        input: selloBuffer,
        gravity: 'northwest',
        left: left,
        top: top
      }])
      .withMetadata()  // ¡AQUÍ ESTÁ LA CLAVE!
      .toBuffer();

  } catch (error) {
    logger.error('Error al aplicar sello', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}
// Exportar como módulo ESM con el nombre esperado por el test
export const FibonacciAureoSeal = {
  crearSelloMBH
};
