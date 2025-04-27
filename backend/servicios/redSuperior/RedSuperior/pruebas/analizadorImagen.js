import RedSuperior from "./redSuperior.js";
import winston from "winston";

// Configuración del logger
const logger = winston.createLogger({
  level: "info",
  transports: [
    new winston.transports.Console({ format: winston.format.simple() }),
    new winston.transports.File({ filename: "./logs/analizadorImagen.log" }),
  ],
});

// Inicializar la Red Superior
const redSuperior = new RedSuperior();

// Función para analizar una imagen
export const analizarImagen = async (datosImagen) => {
  const startTime = Date.now(); // Inicio del temporizador
  try {
    logger.info("⚡ Procesando datos de imagen...");

    // Validar datos de entrada
    if (!Array.isArray(datosImagen) || datosImagen.length === 0) {
      logger.error("❌ Datos de imagen inválidos.");
      throw new Error("Datos de imagen inválidos");
    }

    // Simulación de procesamiento de imagen (reemplazar con lógica real)
    const datosProcesados = preprocesarImagen(datosImagen);

    // Enviar datos a la Red Superior
    const resultadoRedSuperior = redSuperior.analizar(datosProcesados);

    // Registrar el resultado
    logger.info(`✅ Resultado de la Red Superior: ${JSON.stringify(resultadoRedSuperior)}`);

    return resultadoRedSuperior;
  } catch (error) {
    logger.error(`❌ Error al analizar la imagen: ${error.message}`);
    throw new Error("Error al analizar la imagen");
  } finally {
    const endTime = Date.now(); // Fin del temporizador
    logger.info(`🕒 Tiempo total de procesamiento en analizarImagen: ${endTime - startTime}ms`);
  }
};

// Función para preprocesar los datos de la imagen
const preprocesarImagen = (datosImagen) => {
  // Normalizar los datos de la imagen
  return datosImagen.map(valor => parseFloat((valor / 255).toFixed(2)));
};
