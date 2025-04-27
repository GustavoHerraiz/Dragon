import fs from 'fs';
import exifr from 'exifr'; // Para analizar metadatos EXIF
import sharp from 'sharp';
import crypto from 'crypto';
import { logger } from './log.js';

// Cargar listas de software desde archivo JSON
const cargarListaSoftware = () => {
    try {
        const data = fs.readFileSync('/var/www/ProyectoDragon/backend/servicios/analizadores/analizadorHerramientasSospechosas.json', 'utf-8');
        const json = JSON.parse(data);
        return {
            edicion: json.softwareEdicion.map(exp => new RegExp(exp, 'i')),
            generacionIA: json.softwareGeneracionIA.map(exp => new RegExp(exp, 'i')),
            generico: json.softwareGenerico.map(exp => new RegExp(exp, 'i'))
        };
    } catch (error) {
        logger.error(`Error al cargar lista de software sospechoso: ${error.message}`);
        return { edicion: [], generacionIA: [], generico: [] }; // Asegurar que no haya valores undefined
    }
};

const listaSoftware = cargarListaSoftware();

// Razón áurea (f)
const PHI = 1.618033988749895;

// **NUEVO:** Parámetros configurables para la detección de la espiral
const SPIRAL_AREA_SIZE = 8; // Tamaño del área para extraer datos
const SPIRAL_RATIO_TOLERANCE = 0.1; // Tolerancia para la razón áurea

async function detectarSello(imagen) {
    try {
        // Primera línea (5): tres puntos giran
        const { data, info } = await sharp(imagen)
          .greyscale()
          .raw()
          .toBuffer({ resolveWithObject: true });
        
        const puntos = encontrarTresPuntos(data, info);
        if (!esEspiralAurea(puntos)) {
            logger.info("Sello MBH no encontrado: Espiral áurea no detectada.");
            return { encontrado: false, datos: null, centro: null, hash: null };
        }
    
        // Segunda línea (7): centro áureo revela
        const centro = calcularCentro(puntos);
        const datosOcultos = extraerDatos(data, info, centro);
        if (!datosOcultos) {
            logger.warn("Sello MBH no encontrado: No se pudieron extraer datos del centro.");
            return { encontrado: false, datos: null, centro: null, hash: null };
        }
    
        // Tercera línea (5): sello confirma
        const hash = crypto.createHash('sha256').update(datosOcultos).digest('hex');
        logger.info("Sello MBH encontrado: Espiral áurea detectada y datos extraídos.");
        return {
          encontrado: true,
          datos: datosOcultos,
          centro,
          hash
        };
    
      } catch (error) {
        logger.error('Error en análisis de espiral', { error: error.message });
        return { encontrado: false, datos: null, centro: null, hash: null };
      }
}
    
function encontrarTresPuntos(data, { width, height }) {
    let puntos = [];
    let maxContraste = 0;
  
    // Encuentra tres puntos de alto contraste en espiral
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const contraste = Math.abs(
          data[idx] - data[idx - 1] +
          data[idx] - data[idx + 1] +
          data[idx] - data[idx - width] +
          data[idx] - data[idx + width]
        );
  
        if (contraste > maxContraste) {
          maxContraste = contraste;
          puntos.push({ x, y, intensidad: data[idx] });
          if (puntos.length > 3) {
            puntos.shift();
          }
        }
      }
    }
  
    return puntos;
}
    
function esEspiralAurea(puntos) {
    if (puntos.length !== 3) return false;
  
    // Calcula las distancias entre puntos
    const d1 = distancia(puntos[0], puntos[1]);
    const d2 = distancia(puntos[1], puntos[2]);
  
    // Verifica razón áurea (con margen de error configurable)
    const ratio = d2 / d1;
    return Math.abs(ratio - PHI) < SPIRAL_RATIO_TOLERANCE;
}
    
function calcularCentro(puntos) {
    // El centro está en el punto medio del arco
    return {
      x: Math.round((puntos[0].x + puntos[2].x) / 2),
      y: Math.round((puntos[0].y + puntos[2].y) / 2)
    };
}
    
function extraerDatos(data, { width }, centro) {
    // Extrae bytes alrededor del centro (tamaño configurable)
    const radio = SPIRAL_AREA_SIZE / 2; // Ajuste para el radio
    const datos = new Uint8Array(SPIRAL_AREA_SIZE * SPIRAL_AREA_SIZE);
    let idx = 0;
  
    for (let y = -radio; y < radio; y++) {
      for (let x = -radio; x < radio; x++) {
        const pos = (centro.y + y) * width + (centro.x + x);
        datos[idx++] = data[pos];
      }
    }
    return Buffer.from(datos); //Devuelve un Buffer
}
    
function distancia(p1, p2) {
    return Math.sqrt(
      Math.pow(p2.x - p1.x, 2) + 
      Math.pow(p2.y - p1.y, 2)
    );
}

export const analizar = async (rutaArchivo) => {
    const resultado = {
        nombreAnalizador: "FIRMAS_DIGITALES",
        descripcion: "Identifica firmas digitales o rastros en los metadatos que puedan indicar si la imagen ha sido manipulada, autenticada o generada por software específico, y analiza la presencia de un sello visual con patrón áureo.",
        score: null,
        detalles: {
            tipoFirma: "No disponible",
            softwareDetectado: "No disponible",
            esLegitimo: 0,
            mensaje: "Análisis no procesado correctamente.",
            firmaVisual: { // **NUEVO:** Información del sello visual
                encontrado: false,
                centro: null,
                hash: null
            }
        },
        metadatos: {}, // Datos relevantes para la red y cliente
        logs: []
    };

    const softwareFirmasDigitales = {
        softwareDetectado: null,
        version: null,
        tipoFirma: null,
        metadatos: {
            marca: null,
            modelo: null,
            fechaOriginal: null,
            fechaModificacion: null
        },
        confiabilidad: 0.0
    };

    try {
        // Validar la existencia del archivo
        if (!fs.existsSync(rutaArchivo)) {
            throw new Error("El archivo no existe.");
        }
        logger.info("Archivo validado.");
        resultado.logs.push("Archivo validado.");

        const metadatosCompletos = await exifr.parse(rutaArchivo) || {};
        logger.info(`Metadatos EXIF extraídos correctamente: ${JSON.stringify(metadatosCompletos)}`);
        resultado.logs.push("Metadatos EXIF extraídos correctamente.");

        // Extraer software detectado y metadatos
        const softwareDetectado = metadatosCompletos.Software || "No disponible";
        softwareFirmasDigitales.softwareDetectado = softwareDetectado;
        softwareFirmasDigitales.metadatos.marca = metadatosCompletos.Make || null;
        softwareFirmasDigitales.metadatos.modelo = metadatosCompletos.Model || null;
        softwareFirmasDigitales.metadatos.fechaOriginal = metadatosCompletos.DateOriginal || null;
        softwareFirmasDigitales.metadatos.fechaModificacion = metadatosCompletos.ModifyDate || null;

        // Clasificar tipo de firma
        const limpiarNombreSoftware = (nombreSoftware) => {
            if (typeof nombreSoftware !== "string" || !nombreSoftware.trim()) return "Indeterminado"; 
            if (/^\d+(\.\d+)+$/.test(nombreSoftware)) return nombreSoftware; // Versión como "16.7.8"
            return nombreSoftware.replace(/[\d.]+$/g, "").trim();
        };

        const softwareLimpio = limpiarNombreSoftware(softwareDetectado);
        logger.info(`Software limpio procesado: ${softwareLimpio}`);
        resultado.logs.push(`Software limpio procesado: ${softwareLimpio}`);

        if (listaSoftware.edicion.some(regex => regex.test(softwareLimpio))) {
            softwareFirmasDigitales.tipoFirma = "Software de edición detectado";
            softwareFirmasDigitales.confiabilidad = 0.7; // Editado humano
            resultado.detalles.esLegitimo = 1;
        } else if (listaSoftware.generacionIA.some(regex => regex.test(softwareLimpio))) {
            softwareFirmasDigitales.tipoFirma = "Herramienta de generación IA detectada";
            softwareFirmasDigitales.confiabilidad = 0.3; // Sospechoso
            resultado.detalles.esLegitimo = 0;
        } else if (listaSoftware.generico.some(regex => regex.test(softwareLimpio)) || /^\d+(\.\d+)+$/.test(softwareLimpio)) {
            softwareFirmasDigitales.tipoFirma = "Software genérico detectado";
            softwareFirmasDigitales.confiabilidad = 0.8; // Confiable humano
            resultado.detalles.esLegitimo = 1;
        } else {
            softwareFirmasDigitales.tipoFirma = "No identificado";
            softwareFirmasDigitales.confiabilidad = 0.0; // Sin confiabilidad
            resultado.detalles.esLegitimo = 0;
        }

        // Penalización por falta de EXIF
        if (!metadatosCompletos.Make || !metadatosCompletos.Model) {
            softwareFirmasDigitales.tipoFirma = "Metadatos EXIF ausentes";
            softwareFirmasDigitales.confiabilidad = 0.0; // Sospecha de AI
            resultado.detalles.esLegitimo = 0;
        }

        // **NUEVO:** Detectar sello visual
        const selloDetectado = await detectarSello(rutaArchivo);
        resultado.detalles.firmaVisual.encontrado = selloDetectado.encontrado;
        resultado.detalles.firmaVisual.centro = selloDetectado.centro;
        resultado.detalles.firmaVisual.hash = selloDetectado.hash;

        // Asignar datos al resultado
        resultado.detalles.tipoFirma = softwareFirmasDigitales.tipoFirma;
        resultado.detalles.softwareDetectado = softwareLimpio;
        resultado.detalles.mensaje = softwareFirmasDigitales.confiabilidad >= 0.7
            ? "La imagen parece ser legítima."
            : "Análisis indica posible generación o manipulación IA.";
        resultado.detalles.softwareFirmasDigitales = softwareFirmasDigitales;

        // Ajustar puntuación (considerando el sello visual)
        let score = Math.round(softwareFirmasDigitales.confiabilidad * 10);
        if (selloDetectado.encontrado) {
            score = 10; // **MODIFICADO:** Si se encuentra el sello, la puntuación es 10
            resultado.logs.push("Sello visual detectado (MBH), puntuación establecida en 10.");
            logger.info("Sello visual detectado (MBH), puntuación establecida en 10.");
        } else {
            resultado.logs.push("Sello visual NO detectado.");
            logger.info("Sello visual NO detectado.");
        }
        resultado.score = Math.min(score, 10); // No exceder la puntuación máxima
        logger.info(`Puntuación asignada: ${resultado.score}`);
    } catch (error) {
        logger.error(`Error en analizar(): ${error.message}`);
        resultado.logs.push(`Error capturado: ${error.message}`);
        resultado.detalles.mensaje = "Error durante el análisis. Consulte los logs.";
    } finally {
        // Asegurar continuidad del flujo con resultado consistente
        logger.info("Proceso de análisis completado.");
        return resultado;
    }
};