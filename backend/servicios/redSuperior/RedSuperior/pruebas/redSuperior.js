import synaptic from "synaptic";
import winston from "winston";

// Configuración del logger
const logger = winston.createLogger({
  level: "info",
  transports: [
    new winston.transports.Console({ format: winston.format.simple() }),
    new winston.transports.File({ filename: "./logs/redSuperior.log" }),
  ],
});

// Clase RedSuperior basada en Synaptic
export default class RedSuperior {
  constructor() {
    this.network = new synaptic.Architect.Perceptron(10, 16, 3);
  }

  // Método principal para analizar los datos
  analizar(datosEntrada) {
    const startTime = Date.now(); // Inicio del temporizador
    try {
      logger.info("⚡ Analizando datos con la Red Superior...");
      const resultado = this.network.activate(datosEntrada);

      const [humano, ia, dudas] = resultado;
      let decision = "Tengo Dudas";
      let confianza = Math.max(humano, ia, dudas) * 100;

      if (humano > ia && humano > dudas) {
        decision = "Hecho por Humanos";
      } else if (ia > humano && ia > dudas) {
        decision = "Hecho por IA";
      }

      const mensaje = `Decisión: ${decision} | Confianza: ${confianza.toFixed(2)}%`;
      logger.info(`✅ ${mensaje}`);

      return { decision, confianza: parseFloat(confianza.toFixed(2)), mensaje };
    } catch (error) {
      logger.error(`❌ Error en la Red Superior: ${error.message}`);
      throw new Error("Error en la Red Superior");
    } finally {
      const endTime = Date.now(); // Fin del temporizador
      logger.info(`🕒 Tiempo total de procesamiento en RedSuperior: ${endTime - startTime}ms`);
    }
  }
}
