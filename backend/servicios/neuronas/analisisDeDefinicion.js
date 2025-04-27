import synaptic from "synaptic";
import winston from "winston";
import fs from "fs";
import WebSocket from "ws"; // Importación de WebSocket

// Configuración del logger
const logger = winston.createLogger({
  level: "info",
  transports: [
    new winston.transports.Console({ format: winston.format.simple() }),
    new winston.transports.File({ filename: "./logs/redAnalisisDefinicion.log" }),
  ],
});

// Parámetros ordenados y pesos
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

// Clase ajustada
class RedAnalisisDefinicion {
  constructor() {
    try {
      // Intentar cargar el modelo entrenado desde el archivo
      const rawData = fs.readFileSync("./RedDeDefinicion_Entrenada.json", "utf8");
      this.network = synaptic.Network.fromJSON(JSON.parse(rawData));
      logger.info("✅ Modelo cargado desde RedDeDefinicion_Entrenada.json correctamente.");
    } catch (error) {
      // Si hay un error, inicializar la red neuronal por defecto
      logger.error(`❌ Error al cargar el modelo: ${error.message}`);
      this.network = new synaptic.Architect.Perceptron(10, 5, 1);
      logger.info("⚠️ Red neuronal inicializada por defecto.");
    }

    // Intentar establecer comunicación con el servidor central
    logger.info("🌐 Iniciando conexión con el servidor central...");
    this.conectarConServidor();
  }

  conectarConServidor() {
    const socket = new WebSocket("ws://localhost:8080"); // Dirección del servidor central

    logger.info("🔗 Intentando conectar con el servidor central...");

    socket.on("open", () => {
      logger.info("🔗 Conexión con el servidor central establecida.");
      // Mensaje inicial enviado al servidor con un formato completo
      socket.send(
        JSON.stringify({
          red: "analisisDeDefinicion",
          salida: 1, // Valor válido inicial para "salida"
          detalles: { mensaje: "Conexión inicial exitosa." }, // Detalles completos
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
          logger.info("🔧 Ejecutando órdenes obligatorias del servidor central...");
          respuesta.ordenes.forEach((orden) => {
            logger.info(`🔄 Aplicando ${orden.parametro} a ${orden.nuevo_valor || orden.mensaje}`);
            const parametroEncontrado = parametros.find((p) => p.nombre === orden.parametro);
            if (parametroEncontrado && orden.nuevo_valor) {
              parametroEncontrado.peso = orden.nuevo_valor;
              logger.info(`✅ Peso del parámetro ${orden.parametro} actualizado a ${orden.nuevo_valor}.`);
            }
          });

          // Confirmación de ejecución al servidor
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
      setTimeout(() => this.conectarConServidor(), 5000); // Intento de reconexión
    });

    this.socket = socket; // Guardar la referencia al socket
  }

  analizar(datos) {
    try {
      logger.info("📥 Datos recibidos para el análisis:");
      logger.info(JSON.stringify(datos, null, 2));

      // Validar y corregir datos
      datos = datos.map((dato) => (isNaN(dato) || dato === null ? 0 : dato));

      // Procesamiento con la red neuronal
      logger.info("⚙️ Procesando datos con la red neuronal...");
      const resultado = this.network.activate(datos);

      // Evaluar cada parámetro con lógica definida
      let scorePonderado = 0;
      parametros.forEach((parametro, i) => {
        const valor = datos[i];
        const esHumano = parametro.esHumano(valor) ? 1 : 0; // 1 para humano, 0 para IA
        scorePonderado += esHumano * parametro.peso;
        logger.info(`🔍 ${parametro.nombre}: Valor=${valor}, Humano=${esHumano}, Peso=${parametro.peso}`);
      });

      // Calcular el score final invertido usando la PRM
      const scoreFinal = parseFloat(((1 - scorePonderado) * 10).toFixed(2));

      const resultadoFormateado = {
        nombreAnalizador: "analizadorDefinicion",
        descripcion: "Análisis de definición de imagen.",
        score: scoreFinal,
        metadatos: { ancho: datos[0], alto: datos[1], densidad: datos[2] },
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

      // Enviar el resultado al servidor central
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(
          JSON.stringify({
            red: "analisisDeDefinicion",
            salida: resultadoFormateado.score, // Incluye el resultado del análisis
            detalles: resultadoFormateado.detalles, // Detalles adicionales
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

export default RedAnalisisDefinicion;
