import fs from "fs";
import path from "path";
import winston from "winston";
import { fileURLToPath, pathToFileURL } from "url";
import RedAnalisisDefinicion from "./neuronas/analisisDeDefinicion.js";
import RedAnalisisArtefactos from "./neuronas/analisisDeArtefactos.js"; // Nueva red

// Configuración del logger
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
const procesarResultados = (resultados, resultadoDefinicion, resultadoArtefactos) => {
  return resultados
    .filter(({ nombre }) => nombre.toLowerCase() !== "log")
    .map(({ nombre, resultado }) => {
      if (nombre === "analizadorDefinicion" && resultadoDefinicion) {
        logger.info("🔧 Integrando datos de la neurona en analizadorDefinicion...");
        resultado.metadatos.NeuronaDefinicion = {
          score: resultadoDefinicion.score,
          ...resultadoDefinicion.metadatos,
          mensaje: resultadoDefinicion.detalles.mensaje,
        };
      }

      if (nombre === "analizadorArtefactos" && resultadoArtefactos) {
        logger.info("🔧 Integrando datos de la neurona en analizadorArtefactos...");
        resultado.metadatos.NeuronaArtefactos = {
          score: resultadoArtefactos.score,
          ...resultadoArtefactos.metadatos,
          mensaje: resultadoArtefactos.detalles.mensaje,
        };
      }

      return {
        analizador: resultado?.nombreAnalizador || nombre || "Analizador desconocido",
        descripcion: resultado?.descripcion || "Sin descripción.",
        puntuacion: resultado?.score ?? null,
        metadatos: resultado?.metadatos || "Metadatos no disponibles",
        mensaje: resultado?.detalles?.mensaje || "No se proporcionó valoración.",
      };
    });
};

// Calcular puntuaciones generales y decisión
const calcularEvaluacion = (resultados) => {
  const puntajesValidos = resultados
    .filter(({ nombre }) => nombre.toLowerCase() !== "log")
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

// Estructurar la respuesta para `server.js`
const estructurarRespuesta = (resultados, evaluacion, resultadoDefinicion, resultadoArtefactos) => {
  const analizadorBasico = resultados.find(({ resultado }) => resultado?.nombreAnalizador === "VALIDADOR_DE_IMÁGENES");
  const detallesBasicos = analizadorBasico?.resultado?.detalles || {};

  const exifData = resultados
    .filter(({ resultado }) => resultado?.metadatos)
    .map(({ resultado }) => resultado.metadatos)
    .reduce((acc, metadatos) => ({ ...acc, ...metadatos }), {});

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
        exif: Object.keys(exifData).length > 0 ? exifData : "No disponible",
      },
      resultadosDetallados: procesarResultados(resultados, resultadoDefinicion, resultadoArtefactos),
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

    const analizadores = await cargarAnalizadores();
    if (analizadores.length === 0) {
      logger.error("❌ No se encontraron analizadores disponibles.");
      return { error: "No se encontraron analizadores disponibles." };
    }

    const resultados = await Promise.all(
      analizadores.map(async ({ nombre, funcion }) => {
        const resultado = await funcion(filePath);
        return { nombre, resultado };
      })
    );

    const evaluacion = calcularEvaluacion(resultados);

    const datosParaRedDefinicion = resultados.map(({ resultado }) => resultado?.score / 10 || 0);
    const redDefinicion = new RedAnalisisDefinicion();
    const resultadoRedDefinicion = await redDefinicion.analizar(datosParaRedDefinicion);

    const datosParaRedArtefactos = resultados.map(({ resultado }) => resultado?.score / 10 || 0);
    const redArtefactos = new RedAnalisisArtefactos();
    const resultadoRedArtefactos = await redArtefactos.analizar(datosParaRedArtefactos);

    const respuestaFinal = estructurarRespuesta(
      resultados,
      evaluacion,
      resultadoRedDefinicion,
      resultadoRedArtefactos
    );

    logger.info(`✔️ Resultado final:\n${JSON.stringify(respuestaFinal, null, 2)}`);
    return respuestaFinal;
  } catch (error) {
    logger.error(`❌ Error durante el análisis: ${error.message}`);
    return { error: error.message };
  }
};
