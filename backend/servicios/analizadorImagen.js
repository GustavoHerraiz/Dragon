import fs from "fs";
import path from "path";
import winston from "winston";
import { fileURLToPath, pathToFileURL } from "url";
import RedAnalisisDefinicion from "./neuronas/analisisDeDefinicion.js";
import RedAnalisisArtefactos from "./neuronas/analisisDeArtefactos.js";
import RedAnalisisColor from "./neuronas/analisisDeColor.js";
import RedAnalisisExif from "./neuronas/analisisDeExif.js";
import RedAnalisisPantalla from "./neuronas/analisisDePantalla.js";
import RedAnalisisResolucion from "./neuronas/analisisDeResolucion.js";
import RedAnalisisFirmasDigitales from "./neuronas/analisisDeFirmasDigitales.js";
import RedAnalisisTextura from "./neuronas/analisisDeTextura.js";
import SensorFactory from "../utils/SensorFactory.js";

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
    logger.warn("?? Carpeta de analizadores no encontrada.");
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
          logger.info(`? Analizador cargado: ${archivo}`);
        } else {
          logger.warn(`?? ${archivo} no exporta una función 'analizar'.`);
        }
      } catch (error) {
        logger.error(`? Error cargando ${archivo}: ${error.message}`);
      }
    }
  }
  return analizadores;
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

// Procesar resultados de analizadores integrando datos de redes neuronales
const procesarResultados = (
  resultados,
  resultadoDefinicion,
  resultadoArtefactos,
  resultadoColor,
  resultadoExif,
  resultadoRedPantalla,
  resultadoRedResolucion,
  resultadoRedFirmasDigitales,
  resultadoRedTextura
) => {
  return resultados
    .filter(({ nombre }) => nombre.toLowerCase() !== "log")
    .map(({ nombre, resultado }) => {
      if (nombre === "analizadorDefinicion" && resultadoDefinicion) {
        logger.info("?? Integrando datos de la neurona en analizadorDefinicion...");
        resultado.metadatos.NeuronaDefinicion = {
          score: resultadoDefinicion.score,
          ...resultadoDefinicion.metadatos,
          mensaje: resultadoDefinicion.detalles.mensaje,
        };
      }

      if (nombre === "analizadorArtefactos" && resultadoArtefactos) {
        logger.info("?? Integrando datos de la neurona en analizadorArtefactos...");
        const pesoRed = 0.7;
        const pesoAnalizador = 0.3;
        const nuevaPuntuacion = (resultadoArtefactos.score * pesoRed) + (resultado.score * pesoAnalizador);

        resultado.score = parseFloat(nuevaPuntuacion.toFixed(2));
        resultado.metadatos.NeuronaArtefactos = {
          score: resultadoArtefactos.score,
          mensaje: resultadoArtefactos.detalles.mensaje,
        };

        resultado.detalles.mensaje += ` La red neuronal influyó significativamente en este resultado.`;
      }

      // Repetir lógica para otros analizadores como analizadorTextura, analizadorColor, etc.
      return {
        analizador: resultado?.nombreAnalizador || nombre || "Analizador desconocido",
        descripcion: resultado?.descripcion || "Sin descripción.",
        puntuacion: resultado?.score ?? null,
        metadatos: resultado?.metadatos || "Metadatos no disponibles",
        mensaje: resultado?.detalles?.mensaje || "No se proporcionó valoración.",
      };
    });
};
// Función principal para analizar la imagen
export const analizarImagen = async (filePath) => {
  const startTime = Date.now(); // Inicio del tiempo de procesamiento
  const factory = SensorFactory.getInstance();
  const analizadorImagenSensor = factory.getSensor("analizadorImagen");

  try {
    // Verificar si el archivo existe
    if (!fs.existsSync(filePath)) {
      logger.error("? Archivo no encontrado: " + filePath);
      return { error: "Archivo no encontrado" };
    }

    // Cargar analizadores
    const analizadores = await cargarAnalizadores();
    if (analizadores.length === 0) {
      logger.error("? No se encontraron analizadores disponibles.");
      return { error: "No se encontraron analizadores disponibles." };
    }

    // Ejecutar analizadores
    const resultados = await Promise.all(
      analizadores.map(async ({ nombre, funcion }) => {
        try {
          const resultado = await funcion(filePath);
          return { nombre, resultado };
        } catch (err) {
          logger.error(`? Error en analizador ${nombre}: ${err.message}`);
          return { nombre, resultado: null };
        }
      })
    );

    // Calcular evaluación general
    const evaluacion = calcularEvaluacion(resultados);

    // Preparar datos para cada red neuronal
    const redes = [
      { Nombre: "RedAnalisisDefinicion", Clase: RedAnalisisDefinicion },
      { Nombre: "RedAnalisisArtefactos", Clase: RedAnalisisArtefactos },
      { Nombre: "RedAnalisisColor", Clase: RedAnalisisColor },
      { Nombre: "RedAnalisisExif", Clase: RedAnalisisExif },
      { Nombre: "RedAnalisisPantalla", Clase: RedAnalisisPantalla },
      { Nombre: "RedAnalisisResolucion", Clase: RedAnalisisResolucion },
      { Nombre: "RedAnalisisFirmasDigitales", Clase: RedAnalisisFirmasDigitales },
      { Nombre: "RedAnalisisTextura", Clase: RedAnalisisTextura },
    ];

    const resultadosRedes = {};
    for (const { Nombre, Clase } of redes) {
      const datosParaRed = resultados.map(({ resultado }) => resultado?.score / 10 || 0);
      logger.info(`?? Enviando datos a ${Nombre}:`);
      logger.info(JSON.stringify(datosParaRed, null, 2));

      try {
        const red = new Clase();
        resultadosRedes[Nombre] = await red.analizar(datosParaRed);
      } catch (err) {
        logger.error(`? Error en ${Nombre}: ${err.message}`);
        resultadosRedes[Nombre] = null;
      }
    }

    // Finalizar el cálculo de tiempo de procesamiento
    const tiempoProcesamiento = Date.now() - startTime;

    // Emitir métricas al sensor
    if (analizadorImagenSensor) {
      await analizadorImagenSensor.emitirMetrica({
        tiempoProcesamiento,
        confianza: evaluacion.confianza,
        decision: evaluacion.decision,
      });
    } else {
      logger.warn("?? Sensor 'analizadorImagen' no disponible.");
    }

    // Generar la respuesta final con todos los resultados
    const respuestaFinal = {
      mensaje: "Análisis completado",
      resultado: {
        scoreHumano: evaluacion.scoreHumano,
        confianza: evaluacion.confianza,
        decision: evaluacion.decision,
        basico: {
          formato: resultados.find(({ resultado }) => resultado?.detalles?.formato)?.resultado?.detalles?.formato || "Desconocido",
          dimensiones: resultados.find(({ resultado }) => resultado?.detalles?.dimensiones)?.resultado?.detalles?.dimensiones || "No disponible",
          resolucion: resultados.find(({ resultado }) => resultado?.detalles?.resolucion)?.resultado?.detalles?.resolucion || "No disponible",
        },
        resultadosDetallados: procesarResultados(
          resultados,
          resultadosRedes.RedAnalisisDefinicion,
          resultadosRedes.RedAnalisisArtefactos,
          resultadosRedes.RedAnalisisColor,
          resultadosRedes.RedAnalisisExif,
          resultadosRedes.RedAnalisisPantalla,
          resultadosRedes.RedAnalisisResolucion,
          resultadosRedes.RedAnalisisFirmasDigitales,
          resultadosRedes.RedAnalisisTextura
        ),
      },
    };

    logger.info(`? Resultado final:\n${JSON.stringify(respuestaFinal, null, 2)}`);
    return respuestaFinal;
  } catch (error) {
    logger.error(`? Error durante el análisis: ${error.message}`);
    return { error: error.message };
  }
};
// Función para preparar datos de redes neuronales
const prepararDatosRedes = (resultadosAnalizadores) => {
  return {
    definicion: resultadosAnalizadores.find(r => r.nombre === "analizadorDefinicion")?.resultado || { score: 9 },
    artefactos: resultadosAnalizadores.find(r => r.nombre === "analizadorArtefactos")?.resultado || { score: 6 },
    color: resultadosAnalizadores.find(r => r.nombre === "analizadorColor")?.resultado || { score: 9 },
    exif: resultadosAnalizadores.find(r => r.nombre === "analizadorExif")?.resultado || { score: 9 },
    pantalla: resultadosAnalizadores.find(r => r.nombre === "analizadorPantalla")?.resultado || { score: 10 },
    resolucion: resultadosAnalizadores.find(r => r.nombre === "analizadorResolucion")?.resultado || { score: 9 },
    firmas: resultadosAnalizadores.find(r => r.nombre === "analizadorFirmasDigitales")?.resultado || { score: 7 },
    textura: resultadosAnalizadores.find(r => r.nombre === "analizadorTextura")?.resultado || { score: 2.63 }
  };
};

// Implementación del sensor después de generar la respuesta final
export const analizarConSensor = async (filePath) => {
  try {
    // Llamar al flujo principal de análisis
    const respuestaFinal = await analizarImagen(filePath);

    // Validar si el sensor está disponible
    const factory = SensorFactory.getInstance();
    const analizadorImagenSensor = factory.getSensor("analizadorImagen");

    if (analizadorImagenSensor) {
      // Emitir métricas al sensor con la respuesta final
      try {
        await analizadorImagenSensor.emitirMetrica({
          tiempoProcesamiento: respuestaFinal.resultado?.tiempoProcesamiento || 0,
          confianza: respuestaFinal.resultado?.confianza || 0,
          decision: respuestaFinal.resultado?.decision || "Desconocida",
        });
        logger.info("? Métricas enviadas al sensor correctamente.");
      } catch (sensorError) {
        logger.error(`? Error al enviar métricas al sensor: ${sensorError.message}`);
      }
    } else {
      logger.warn("?? Sensor 'analizadorImagen' no disponible.");
    }

    // Retornar la respuesta final al cliente o servidor
    return respuestaFinal;

  } catch (error) {
    logger.error(`? Error en analizarConSensor: ${error.message}`);
    return { error: error.message };
  }
};