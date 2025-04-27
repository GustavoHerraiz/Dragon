import synaptic from "synaptic";
import winston from "winston";
import { createClient } from "redis";

// Configuración del logger con soporte para UTF-8
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      // Asegurar UTF-8 en los mensajes
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    new winston.transports.File({
      filename: "./logs/redSuperior.log",
      options: { flags: "a", encoding: "utf8" }, // Forzar UTF-8
    }),
  ],
});

// Clase RedSuperior basada en Synaptic
export default class RedSuperior {
  constructor() {
    this.network = new synaptic.Architect.Perceptron(10, 16, 3);
    this.redisClient = createClient(); // Crear cliente Redis
    this.redisClient.connect().then(() => logger.info("Redis conectado."));
  }

  // Método para validar los datos de entrada
  validarDatos(datosEntrada) {
    if (!Array.isArray(datosEntrada) || datosEntrada.length !== 10 || !datosEntrada.every(num => num >= 0 && num <= 1)) {
      throw new Error("? Los datos de entrada deben ser un array de 10 valores normalizados entre 0 y 1.");
    }
  }

  // Método principal para analizar los datos
  async analizar(datosEntrada) {
    const startTime = Date.now(); // Inicio del temporizador
    try {
      // Validar los datos de entrada
      this.validarDatos(datosEntrada);

      logger.info("? Analizando datos con la Red Superior...");
      const resultado = this.network.activate(datosEntrada);

      const [humano, ia, dudas] = resultado;
      let decision = "Tengo Dudas";
      let confianza = Math.max(humano, ia, dudas) * 100;

      // Determinar la decisión basada en los resultados
      if (humano > ia && humano > dudas) {
        decision = "Hecho por Humanos";
      } else if (ia > humano && ia > dudas) {
        decision = "Hecho por IA";
      }

      const mensaje = `Decisión: ${decision} | Confianza: ${confianza.toFixed(2)}%`;
      logger.info(`? ${mensaje}`);

      // Preparar el pulso
      const pulso = {
        timestamp: new Date().toISOString(),
        componente: "redSuperior",
        decision,
        confianza: parseFloat(confianza.toFixed(2)),
        datosEntrada, // Incluir los datos originales para trazabilidad
      };

      // Enviar el pulso a Redis
      await this.redisClient.publish("dragon:pulse:redSuperior", JSON.stringify(pulso));
      logger.info(`? Pulso enviado correctamente: ${JSON.stringify(pulso)}`);

      return { decision, confianza: parseFloat(confianza.toFixed(2)), mensaje };
    } catch (error) {
      logger.error(`? Error en la Red Superior: ${error.message}`);
      throw new Error("Error en la Red Superior");
    } finally {
      const endTime = Date.now(); // Fin del temporizador
      logger.info(`?? Tiempo total de procesamiento en RedSuperior: ${endTime - startTime}ms`);
    }
  }

  // Método para cerrar el cliente Redis
  async cerrarRedis() {
    await this.redisClient.quit();
    logger.info("?? Cliente de Redis cerrado correctamente.");
  }
}