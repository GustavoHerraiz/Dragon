import synaptic from "synaptic";
import winston from "winston";
import fs from "fs";
import WebSocket from "ws";
import { fileURLToPath } from "url";
import path from "path"; // Manejo de rutas

// Definir __dirname de forma compatible con ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración del logger
const logger = winston.createLogger({
  level: "info",
  transports: [
    new winston.transports.Console({ format: winston.format.simple() }),
    new winston.transports.File({ filename: "./logs/redAnalisisResolucion.log" }),
  ],
});

// Parámetros y lógica específica para el análisis de resolución
const parametros = [
  { nombre: "Dimensiones", grupo: "ValoresBajosIA", peso: 0.2, esHumano: (valor) => valor > 3000 },
  { nombre: "Resolución Horizontal", grupo: "ValoresAltosIA", peso: 0.15, esHumano: (valor) => valor >= 300 && valor <= 600 },
  { nombre: "Resolución Vertical", grupo: "ValoresAltosIA", peso: 0.15, esHumano: (valor) => valor >= 300 && valor <= 600 },
  { nombre: "Proporción", grupo: "ValoresAltosIA", peso: 0.3, esHumano: (valor) => valor > 1.3 && valor < 1.8 },
  { nombre: "Clasificación Proporción", grupo: "ValoresAltosHumanos", peso: 0.2, esHumano: (valor) => valor === "16:9" || valor === "4:3" },
];

// Función para tratar los datos según su grupo lógico
const tratarDato = (valor, grupo) => {
  try {
    if (valor === null || isNaN(valor)) {
      switch (grupo) {
        case "ValoresAltosHumanos":
          logger.warn(`⚠️ Dato nulo en grupo ${grupo}: Penalizando con 0.`);
          return 0;
        case "ValoresBajosHumanos":
          logger.warn(`⚠️ Dato nulo en grupo ${grupo}: Favoreciendo con 1.`);
          return 1;
        case "ValoresAltosIA":
          logger.warn(`⚠️ Dato nulo en grupo ${grupo}: Penalizando con 0.`);
          return 0;
        case "ValoresBajosIA":
          logger.warn(`⚠️ Dato nulo en grupo ${grupo}: Favoreciendo con 1.`);
          return 1;
        default:
          logger.error(`❌ Grupo lógico desconocido: ${grupo}`);
          return 0; // Predeterminado para evitar bloqueos
      }
    }
    return valor; // Retorna el valor si no es nulo
  } catch (error) {
    logger.error(`❌ Error en tratarDato: ${error.message}`);
    return 0; // Predeterminado en caso de error
  }
};

class RedAnalisisResolucion {
  constructor() {
    try {
      const rutaModelo = path.join(__dirname, "RedDeResolucion_Entrenada.json");
      const rawData = fs.readFileSync(rutaModelo, "utf8");
      this.network = synaptic.Network.fromJSON(JSON.parse(rawData));
      logger.info("✅ Modelo cargado desde RedDeResolucion_Entrenada.json correctamente.");
    } catch (error) {
      logger.error(`❌ Error al cargar el modelo: ${error.message}`);
      this.network = new synaptic.Architect.Perceptron(5, 3, 1);
      logger.info("⚠️ Red neuronal inicializada por defecto.");
    }

    logger.info("🌐 Iniciando conexión con el servidor central...");
    this.conectarConServidor();
  }

  conectarConServidor() {
    const socket = new WebSocket("ws://localhost:8080");

    socket.on("open", () => {
      logger.info("🔗 Conexión con el servidor central establecida.");
      socket.send(
        JSON.stringify({
          red: "analisisDeResolucion",
          salida: 1,
          detalles: { mensaje: "Conexión inicial exitosa." },
        })
      );
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

          socket.send(
            JSON.stringify({
              tipo: "confirmacion",
              mensaje: "Órdenes ejecutadas con éxito.",
              detalles: respuesta.ordenes,
            })
          );
          logger.info("✅ Confirmación enviada al servidor central.");
        }
      } catch (error) {
        logger.error(`❌ Error al procesar el mensaje recibido: ${error.message}`);
      }
    });

    socket.on("close", () => {
      logger.warn("🔌 Conexión cerrada con el servidor central. Intentando reconectar en 5 segundos...");
      setTimeout(() => this.conectarConServidor(), 5000);
    });

    this.socket = socket;
  }

  analizar(datos) {
    try {
      logger.info(`📥 Datos entrantes para análisis: ${JSON.stringify(datos)}`);

      const datosTratados = datos.map((dato, index) => {
        try {
          const parametro = parametros[index];
          if (!parametro) {
            logger.error(`❌ Parámetro en índice ${index} está indefinido. Asignando valor predeterminado.`);
            return 0; // Predeterminado para evitar bloqueos
          }
          logger.info(`🔍 Tratando dato: ${dato}, Parámetro: ${JSON.stringify(parametro)}`);
          return tratarDato(dato, parametro.grupo);
        } catch (error) {
          logger.error(`❌ Error durante tratamiento de dato en índice ${index}: ${error.message}`);
          return 0; // Valor predeterminado para evitar interrupciones
        }
      });
      logger.info(`🔄 Datos tratados: ${JSON.stringify(datosTratados)}`);

      const resultado = this.network.activate(datosTratados);
      logger.info(`🔮 Resultado de la red neuronal: ${JSON.stringify(resultado)}`);

      let scorePonderado = 0;
      parametros.forEach((parametro, i) => {
        try {
          const valor = datosTratados[i];
          const esHumano = parametro.esHumano(valor) ? 1 : 0;
          scorePonderado += esHumano * parametro.peso;
          logger.info(`📊 Parámetro: ${parametro.nombre}, Valor: ${valor}, Peso: ${parametro.peso}, EsHumano: ${esHumano}`);
        } catch (error) {
          logger.error(`❌ Error en cálculo ponderado para parámetro en índice ${i}: ${error.message}`);
        }
      });

      const scoreFinal = parseFloat(((1 - scorePonderado) * 10).toFixed(2));
      logger.info(`✔️ Score final calculado: ${scoreFinal}`);

      const mensajeFinal =
        scoreFinal >= 8
          ? "La imagen tiene una resolución excelente."
          : scoreFinal <= 3
          ? "Resolución baja o parámetros atípicos."
          : "Resolución intermedia.";

      const resultadoFormateado = {
        nombreAnalizador: "analizadorResolucion",
        descripcion: "Análisis de la resolución de la imagen.",
        score: scoreFinal,
        metadatos: {
          dimensiones: datosTratados[0] || "No definido",
          resolucionHorizontal: datosTratados[1] || "No definido",
          resolucionVertical: datosTratados[2] || "No definido",
          proporcion: datosTratados[3] || "No definido",
        },
        detalles: { mensaje: mensajeFinal },
      };

      logger.info(`📤 Resultado del análisis formateado: ${JSON.stringify(resultadoFormateado)}`);

      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(
          JSON.stringify({
            red: "analisisDeResolucion",
            salida: resultadoFormateado.score,
            detalles: resultadoFormateado.detalles,
          })
        );
      }

      return resultadoFormateado;
    } catch (error) {
      logger.error(`❌ Error general durante el análisis: ${error.message}`);
      return {
        nombreAnalizador: "analizadorResolucion",
        descripcion: "Análisis de la resolución de la imagen.",
        score: 0,
        metadatos: {},
        detalles: { mensaje: "Error durante el análisis, pero el programa continúa." },
      };
    }
  }
}

export default RedAnalisisResolucion;
