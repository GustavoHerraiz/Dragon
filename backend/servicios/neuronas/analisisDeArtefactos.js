import synaptic from "synaptic"; // Para la red neuronal
import winston from "winston"; // Para manejo de logs
import fs from "fs"; // Para lectura de archivos
import { fileURLToPath } from "url"; // Para resolver __dirname
import { dirname, join } from "path"; // Para manejo de rutas
import WebSocket from "ws"; // Para conexión con servidor central

// Resolviendo __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuración del logger
const logger = winston.createLogger({
  level: "info",
  transports: [
    new winston.transports.Console({ format: winston.format.simple() }),
    new winston.transports.File({ filename: "./logs/analisisDeArtefactos.log" }),
  ],
});

// Parámetros predefinidos con lógica específica
const parametros = [
  { nombre: "Ancho", peso: 0.1, esHumano: (valor) => valor > 0.3 && valor < 0.7 },
  { nombre: "Alto", peso: 0.1, esHumano: (valor) => valor > 0.3 && valor < 0.7 },
  { nombre: "Densidad", peso: 0.15, esHumano: (valor) => valor < 0.5 },
  { nombre: "Resolución Horizontal", peso: 0.1, esHumano: (valor) => valor < 0.6 },
  { nombre: "Resolución Vertical", peso: 0.1, esHumano: (valor) => valor < 0.6 },
  { nombre: "Proporción de Dimensiones", peso: 0.1, esHumano: (valor) => valor > 0.4 && valor < 0.8 },
  { nombre: "Complejidad", peso: 0.15, esHumano: (valor) => valor > 0.6 },
  { nombre: "Uniformidad", peso: 0.1, esHumano: (valor) => valor < 0.5 },
  { nombre: "Gradiente Promedio", peso: 0.1, esHumano: (valor) => valor < 0.4 },
  { nombre: "Artefactos Detectados", peso: 0.1, esHumano: (valor) => valor > 0.5 },
];

/**
 * Clase para analizar artefactos usando parámetros específicos
 */
class AnalisisDeArtefactos {
  constructor() {
    try {
      const rutaCompleta = join(__dirname, "RedDeArtefactos_Entrenada.json");
      const rawData = fs.readFileSync(rutaCompleta, "utf8");
      const datosModelo = JSON.parse(rawData);

      // Cargar modelo neuronal entrenado
      this.network = synaptic.Network.fromJSON(datosModelo);
      logger.info(`✅ Modelo cargado desde ${rutaCompleta} correctamente.`);
    } catch (error) {
      logger.error(`❌ Error al cargar el modelo: ${error.message}`);
      this.network = new synaptic.Architect.Perceptron(10, 5, 1); // Red por defecto
      logger.info("⚠️ Red neuronal inicializada por defecto.");
    }

    this.conectarConServidor(); // Establecer conexión
  }

  conectarConServidor() {
    const socket = new WebSocket("ws://localhost:8080");

    socket.on("open", () => {
      logger.info("🔗 Conexión establecida.");
      socket.send(
        JSON.stringify({
          red: "analizadorArtefactos",
          salida: 1,
          detalles: { mensaje: "Conexión inicial exitosa." },
        })
      );
    });

    socket.on("message", (message) => {
      try {
        const respuesta = JSON.parse(message);

        if (respuesta.tipo === "orden" && respuesta.ordenes) {
          respuesta.ordenes.forEach((orden) => {
            const parametro = parametros.find((p) => p.nombre === orden.parametro);
            if (parametro && orden.nuevo_valor) {
              parametro.peso = orden.nuevo_valor;
              logger.info(`✅ Peso actualizado: ${orden.parametro} → ${orden.nuevo_valor}`);
            }
          });

          // Confirmar al servidor central
          socket.send(
            JSON.stringify({
              tipo: "confirmacion",
              mensaje: "Órdenes ejecutadas con éxito.",
              detalles: respuesta.ordenes,
            })
          );
          logger.info("📤 Confirmación enviada al servidor central.");
        }
      } catch (error) {
        logger.error(`❌ Error al procesar mensaje: ${error.message}`);
      }
    });

    socket.on("close", () => {
      logger.warn("🔌 Conexión cerrada. Reintentando en 5 segundos...");
      setTimeout(() => this.conectarConServidor(), 5000);
    });

    this.socket = socket;
  }

  analizar(datos) {
    try {
      logger.info("📥 Datos recibidos para el análisis:");
      logger.info(JSON.stringify(datos, null, 2));

      // Validar y corregir datos
      datos = datos.map((dato) => (isNaN(dato) || dato === null ? 0 : dato));

      // Calcular el score ponderado usando PRM definitiva
      let scorePonderado = 0;
      parametros.forEach((parametro, i) => {
        const valor = datos[i];
        const esHumano = parametro.esHumano(valor) ? 1 : 0; // 1 para humano, 0 para IA
        scorePonderado += esHumano * parametro.peso;
        logger.info(`🔍 ${parametro.nombre}: Valor=${valor}, Humano=${esHumano}, Peso=${parametro.peso}`);
      });

      // Calcular el score final utilizando la lógica PRM
      const scoreFinal = parseFloat(((1 - scorePonderado) * 10).toFixed(2));

      const resultadoFormateado = {
        nombreAnalizador: "analizadorArtefactos",
        score: scoreFinal,
        detalles: {
          mensaje:
            scoreFinal >= 8
              ? "La imagen presenta pocos artefactos. Probablemente sea humana."
              : scoreFinal <= 3
              ? "La imagen tiene muchos artefactos. Probablemente sea generada por IA."
              : "La imagen tiene características intermedias.",
        },
      };

      logger.info("📄 Resultado formateado:");
      logger.info(JSON.stringify(resultadoFormateado, null, 2));

      // Enviar el resultado al servidor central
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(
          JSON.stringify({
            red: "analizadorArtefactos",
            salida: resultadoFormateado.score,
            detalles: resultadoFormateado.detalles,
          })
        );
        logger.info("📤 Resultado enviado al servidor central.");
      } else {
        logger.warn("⚠️ Conexión no establecida. No se pudo enviar el resultado.");
      }

      return resultadoFormateado;
    } catch (error) {
      logger.error(`❌ Error durante el análisis: ${error.message}`);
      return { error: error.message };
    }
  }
}

export default AnalisisDeArtefactos;
