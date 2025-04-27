import synaptic from "synaptic";
import winston from "winston";
import fs from "fs";
import WebSocket from "ws";
import path from "path";
import { fileURLToPath } from "url";

// Configuración de __dirname para ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración del logger
const logger = winston.createLogger({
  level: "info",
  transports: [
    new winston.transports.Console({ format: winston.format.simple() }),
    new winston.transports.File({ filename: "./logs/analizadorExif.log" }),
  ],
});

// Parámetros ordenados y pesos
const parametros = [
  { nombre: "DimensionesExif", peso: 0.1, esHumano: (valor) => valor > 0.3 && valor < 0.7 },
  { nombre: "Software", peso: 0.1, esHumano: (valor) => valor === 0.5 },
  { nombre: "FechaOriginal", peso: 0.15, esHumano: (valor) => valor < 0.6 },
  { nombre: "FechaModificacion", peso: 0.1, esHumano: (valor) => valor < 0.6 },
  { nombre: "ResoluciónHorizontal", peso: 0.1, esHumano: (valor) => valor > 0.4 && valor < 0.8 },
  { nombre: "ResoluciónVertical", peso: 0.1, esHumano: (valor) => valor > 0.4 && valor < 0.8 },
  { nombre: "ProporciónDimensiones", peso: 0.1, esHumano: (valor) => valor > 0.3 && valor < 0.7 },
  { nombre: "Complejidad", peso: 0.15, esHumano: (valor) => valor > 0.6 },
  { nombre: "Uniformidad", peso: 0.1, esHumano: (valor) => valor < 0.5 },
  { nombre: "ArtefactosDetectados", peso: 0.1, esHumano: (valor) => valor > 0.5 },
];

class RedAnalisisExif {
  constructor() {
    try {
      // Cargar el modelo entrenado
      const rutaModelo = path.resolve(__dirname, "RedDeExif_Entrenada.json");
      const rawData = fs.readFileSync(rutaModelo, "utf8");
      this.network = synaptic.Network.fromJSON(JSON.parse(rawData));
      logger.info(`✅ Modelo cargado desde ${rutaModelo} correctamente.`);
    } catch (error) {
      logger.error(`❌ Error al cargar el modelo: ${error.message}`);
      this.network = new synaptic.Architect.Perceptron(10, 5, 1);
      logger.info("⚠️ Red neuronal inicializada por defecto.");
    }

    // Intentar establecer conexión con el servidor
    logger.info("🌐 Iniciando conexión con el servidor central...");
    this.conectarConServidor();
  }

  conectarConServidor() {
    const socket = new WebSocket("ws://localhost:8080");

    logger.info("🔗 Intentando conectar con el servidor central...");

    socket.on("open", () => {
      logger.info("🔗 Conexión con el servidor central establecida.");
      socket.send(
        JSON.stringify({
          red: "analisisDeExif",
          salida: 1,
          detalles: { mensaje: "Conexión inicial exitosa." },
        })
      );
    });

    socket.on("error", (error) => {
      logger.error(`❌ Error en la conexión WebSocket: ${error.message}`);
    });

    socket.on("message", (message) => {
      try {
        const respuesta = JSON.parse(message);
        logger.info(`📨 Mensaje recibido del servidor central: ${JSON.stringify(respuesta)}`);

        if (respuesta.tipo === "orden" && respuesta.ordenes) {
          respuesta.ordenes.forEach((orden) => {
            const parametroEncontrado = parametros.find((p) => p.nombre === orden.parametro);
            if (parametroEncontrado && orden.nuevo_valor) {
              parametroEncontrado.peso = orden.nuevo_valor;
              logger.info(`✅ Peso del parámetro ${orden.parametro} actualizado a ${orden.nuevo_valor}.`);
            }
          });

          // Confirmación de ejecución
          socket.send(
            JSON.stringify({
              tipo: "confirmacion",
              mensaje: "Órdenes ejecutadas con éxito.",
              detalles: respuesta.ordenes,
            })
          );
        }
      } catch (error) {
        logger.error(`❌ Error al procesar el mensaje recibido: ${error.message}`);
      }
    });

    socket.on("close", () => {
      logger.warn("🔌 Conexión cerrada. Intentando reconectar...");
      setTimeout(() => this.conectarConServidor(), 5000);
    });

    this.socket = socket;
  }

  analizar(datos) {
    try {
      logger.info("📥 Datos recibidos para el análisis:");
      logger.info(JSON.stringify(datos, null, 2));

      datos = datos.map((dato) => (isNaN(dato) || dato === null ? 0 : dato));

      logger.info("⚙️ Procesando datos con la red neuronal...");
      const resultado = this.network.activate(datos);

      let scorePonderado = 0;
      parametros.forEach((parametro, i) => {
        const valor = datos[i];
        const esHumano = parametro.esHumano(valor) ? 1 : 0;
        scorePonderado += esHumano * parametro.peso;
        logger.info(`🔍 ${parametro.nombre}: Valor=${valor}, Humano=${esHumano}, Peso=${parametro.peso}`);
      });

      const scoreFinal = parseFloat(((1 - scorePonderado) * 10).toFixed(2));

      const resultadoFormateado = {
        nombreAnalizador: "analizadorExif",
        descripcion: "Análisis de metadatos EXIF.",
        score: scoreFinal,
        metadatos: {
          dimensionesExif: datos[0] || "No definido",
          software: datos[1] || "Desconocido",
          fechaOriginal: datos[2] || "No definida",
          fechaModificacion: datos[3] || "No definida",
        },
        detalles: {
          mensaje:
            scoreFinal >= 8
              ? "La imagen presenta características humanas claras."
              : scoreFinal <= 3
              ? "La imagen presenta características típicas de IA."
              : "La imagen muestra características intermedias entre humano e IA.",
        },
      };

      logger.info("📄 Resultado formateado para el sistema:");
      logger.info(JSON.stringify(resultadoFormateado, null, 2));

      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(
          JSON.stringify({
            red: "analisisDeExif",
            salida: resultadoFormateado.score,
            detalles: resultadoFormateado.detalles,
          })
        );
        logger.info("📤 Resultado enviado al servidor central.");
      } else {
        logger.warn("⚠️ No se pudo enviar el resultado, conexión no establecida.");
      }

      return resultadoFormateado;
    } catch (error) {
      logger.error(`❌ Error durante el análisis: ${error.message}`);
      return {
        error: "Ocurrió un error durante el análisis.",
        detalles: { mensaje: error.message },
      };
    }
  }
}

export default RedAnalisisExif;
