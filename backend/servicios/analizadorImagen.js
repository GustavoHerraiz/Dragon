import fs from "fs";
import path from "path";
import winston from "winston";
import { fileURLToPath, pathToFileURL } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración del logger
const logger = winston.createLogger({
    level: "info",
    transports: [
        new winston.transports.Console({ format: winston.format.simple() }),
        new winston.transports.File({ filename: "./logs/analizadorImagen.log" }),
    ],
});

// Función para cargar analizadores dinámicamente
const cargarAnalizadores = async () => {
    const carpetaAnalizadores = path.join(__dirname, "analizadores");
    const analizadores = [];

    if (!fs.existsSync(carpetaAnalizadores)) {
        logger.warn("📁 Carpeta de analizadores no encontrada.");
        return analizadores;
    }

    const archivos = fs.readdirSync(carpetaAnalizadores);
    for (const archivo of archivos) {
        if (archivo.endsWith(".js")) {
            try {
                const rutaCompleta = path.join(carpetaAnalizadores, archivo);
                const { analizar } = await import(pathToFileURL(rutaCompleta).href);

                if (analizar && typeof analizar === "function") {
                    analizadores.push({ nombre: archivo.replace(".js", ""), funcion: analizar });
                    logger.info(`✔️ Analizador cargado: ${archivo}`);
                } else {
                    logger.warn(`⚠️ ${archivo} no exporta una función 'analizar'.`);
                }
            } catch (error) {
                logger.error(`❌ Error cargando ${archivo}: ${error.message}`);
            }
        }
    }
    return analizadores;
};

// Procesar resultados de los analizadores
const procesarResultados = (resultados) => {
    return resultados
        .filter(({ nombre }) => nombre.toLowerCase() !== "log") // Filtrar el analizador 'log'
        .map(({ nombre, resultado }) => ({
            analizador: resultado?.nombreAnalizador || nombre || "Analizador desconocido",
            descripcion: resultado?.descripcion || "Sin descripción.",
            puntuacion: resultado?.score ?? null,
            // Corregir aquí para usar el campo metadatos del resultado del analizador
            metadatos: resultado?.metadatos || "Metadatos no disponibles",
            mensaje: resultado?.detalles?.mensaje || "No se proporcionó valoración.",
        }));
};



// Calcular puntuaciones generales y decisión
const calcularEvaluacion = (resultados) => {
    // Excluir el analizador 'log' del cálculo
    const puntajesValidos = resultados
        .filter(({ nombre }) => nombre.toLowerCase() !== "log") // Filtrar 'log'
        .map(({ resultado }) => resultado?.score)
        .filter((score) => typeof score === "number" && score >= 0);

    const totalPuntaje = puntajesValidos.reduce((suma, score) => suma + score, 0);
    const cantidad = puntajesValidos.length;

    const scoreHumano = cantidad > 0 ? totalPuntaje / cantidad : 0;
    const confianza = parseFloat((scoreHumano * 10).toFixed(2));
    const decision = scoreHumano >= 7 ? "Imagen creada por humano" : "Imagen generada por IA";

    return {
        scoreHumano: parseFloat(scoreHumano.toFixed(2)),
        confianza,
        decision,
    };
};


// Estructurar la respuesta para `server.js` (con datos reales y precisos)
const estructurarRespuesta = (resultados, evaluacion) => {
    // Extraer detalles básicos del analizador específico
    const analizadorBasico = resultados.find(({ resultado }) => resultado?.nombreAnalizador === "VALIDADOR_DE_IMÁGENES");
    const detallesBasicos = analizadorBasico?.resultado?.detalles || {};

    // Recopilar EXIF desde todos los analizadores
    const exifData = resultados
        .filter(({ resultado }) => resultado?.metadatos)
        .map(({ resultado }) => resultado.metadatos)
        .reduce((acc, metadatos) => {
            const { Formato, Dimensiones, Resolución, ...restoEXIF } = metadatos; // Eliminar redundancias
            return { ...acc, ...restoEXIF }; // Combinar EXIF relevante
        }, {});

    return {
        mensaje: "Análisis completado",
        resultado: {
            scoreHumano: evaluacion.scoreHumano,
            confianza: evaluacion.confianza,
            decision: evaluacion.decision,
            basico: {
                formato: detallesBasicos.formato || "Desconocido",
                dimensiones: detallesBasicos.dimensiones || "No disponible",
                resolucion: detallesBasicos.resolucion || "No disponible",
                exif: Object.keys(exifData).length > 0 ? exifData : "No disponible", // Asignar EXIF limpio
            },
            resultadosDetallados: procesarResultados(resultados), // Procesar resultados clave
        },
    };
};





// Función principal para analizar la imagen
export const analizarImagen = async (filePath) => {
    try {
        if (!fs.existsSync(filePath)) {
            logger.error("❌ Archivo no encontrado.");
            return { error: "Archivo no encontrado" };
        }

        // Cargar analizadores
        const analizadores = await cargarAnalizadores();
        if (analizadores.length === 0) {
            logger.error("❌ No se encontraron analizadores disponibles.");
            return { error: "No se encontraron analizadores disponibles." };
        }

        // Ejecutar analizadores
        const resultados = await Promise.all(
            analizadores.map(async ({ nombre, funcion }) => {
                const resultado = await funcion(filePath);
                return { nombre, resultado };
            })
        );

        // Calcular evaluación general
        const evaluacion = calcularEvaluacion(resultados);

        // Crear la respuesta final para el servidor
        const respuestaFinal = estructurarRespuesta(resultados, evaluacion);

        // Log del resultado final
        logger.info(`✔️ Resultado final:\n${JSON.stringify(respuestaFinal, null, 2)}`);

        return respuestaFinal;
    } catch (error) {
        logger.error(`❌ Error durante el análisis: ${error.message}`);
        return { error: error.message };
    }
};
