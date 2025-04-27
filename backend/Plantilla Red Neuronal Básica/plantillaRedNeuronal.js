import synaptic from "synaptic";
import winston from "winston";
import fs from "fs";
import WebSocket from "ws";

// Configuración del logger central
const logger = winston.createLogger({
  level: "info",
  transports: [
    new winston.transports.Console({ format: winston.format.simple() }),
    new winston.transports.File({ filename: "./logs/analizadorOptimizado.log" }),
  ],
});

/**
 * Clase para crear redes neuronales modulares
 * Adaptable a cualquier analizador mediante parámetros y configuración dinámica.
 */
class RedNeuronalBasica {
  constructor(nombreRed, rutaModelo, parametros, factorEscala = 10) {
    this.nombreRed = nombreRed || "RedGenerica";
    this.parametros = this.validarParametros(parametros); // Validación inicial de parámetros
    this.factorEscala = factorEscala;

    // Cargar modelo entrenado o inicializar una red neuronal básica
    this.network = this.cargarModelo(rutaModelo);

    // Establecer conexión con el servidor central (opcional)
    this.socket = this.conectarConServidor();
  }

  /**
   * Valida o genera parámetros predeterminados si no son válidos
   * @param {Array} parametros - Lista de parámetros con pesos asignados.
   * @returns {Array} - Lista de parámetros válidos.
   */
  validarParametros(parametros) {
    if (!Array.isArray(parametros) || parametros.length === 0) {
      logger.warn("⚠️ Parámetros no válidos. Generando valores predeterminados...");
      return Array(10).fill().map((_, index) => ({
        nombre: `Parametro_${index + 1}`,
        peso: 0.1,
      }));
    }
    return parametros;
  }

  /**
   * Carga el modelo JSON entrenado o inicializa por defecto
   * @param {string} rutaModelo - Ruta al modelo JSON.
   * @returns {synaptic.Network} - Red neuronal cargada o una nueva por defecto.
   */
  cargarModelo(rutaModelo) {
    try {
      const rawData = fs.readFileSync(rutaModelo, "utf8");
      logger.info(`✅ Modelo cargado desde ${rutaModelo}.`);
      return synaptic.Network.fromJSON(JSON.parse(rawData));
    } catch (error) {
      logger.error(`❌ Error al cargar el modelo: ${error.message}`);
      logger.info("⚠️ Red neuronal inicializada por defecto.");
      return new synaptic.Architect.Perceptron(this.parametros.length, 5, 1);
    }
  }

  /**
   * Establece conexión robusta con servidor central (opcional)
   * @returns {WebSocket} - Instancia de WebSocket.
   */
  conectarConServidor() {
    const socket = new WebSocket("ws://localhost:8080");

    socket.on("open", () => {
      logger.info("🔗 Conexión establecida.");
      const mensajeInicial = {
        red: this.nombreRed,
        salida: 1,
        detalles: { mensaje: "Conexión inicial exitosa." },
      };

      if (!mensajeInicial.red || !mensajeInicial.salida || !mensajeInicial.detalles) {
        logger.error("❌ Mensaje inicial incompleto. No se envió.");
        return;
      }

      socket.send(JSON.stringify(mensajeInicial));
    });

    socket.on("message", (message) => {
      try {
        const respuesta = JSON.parse(message);
        respuesta.ordenes?.forEach((orden) => this.actualizarParametro(orden));

        // Confirmar órdenes ejecutadas
        socket.send(
          JSON.stringify({
            tipo: "confirmacion",
            mensaje: "Órdenes ejecutadas con éxito.",
            detalles: respuesta.ordenes,
          })
        );
        logger.info("📤 Confirmación enviada al servidor central.");
      } catch (error) {
        logger.error(`❌ Error al procesar mensaje: ${error.message}`);
      }
    });

    socket.on("close", () => {
      logger.warn("🔌 Conexión cerrada. Reintentando...");
      setTimeout(() => this.conectarConServidor(), 5000);
    });

    return socket;
  }

  /**
   * Actualiza un parámetro específico según una orden recibida
   * @param {Object} orden - Orden para actualizar un parámetro.
   */
  actualizarParametro(orden) {
    const parametro = this.parametros.find((p) => p.nombre === orden.parametro);
    if (parametro) {
      parametro.peso = orden.nuevo_valor;
      logger.info(`✅ Peso actualizado: ${orden.parametro} → ${orden.nuevo_valor}`);
    } else {
      logger.warn(`⚠️ Parámetro no encontrado: ${orden.parametro}`);
    }
  }

  /**
   * Normaliza los datos y calcula el score final
   * @param {Array} datos - Datos de entrada (deben coincidir con los parámetros).
   * @returns {Object} - Resultado del análisis.
   */
  analizar(datos) {
    try {
      if (!Array.isArray(datos) || datos.length !== this.parametros.length) {
        throw new Error("Los datos de entrada son inválidos.");
      }

      // Normalización de los datos entre 0 y 1
      const datosNormalizados = datos.map((dato) => Math.max(0, Math.min(1, dato)));

      // Media ponderada según los pesos de los parámetros
      const mediaPonderada = datosNormalizados.reduce(
        (acum, valor, i) => acum + valor * this.parametros[i].peso,
        0
      );

      // Calcular el score final con la escala definida
      const scoreFinal = parseFloat(((1 - mediaPonderada) * this.factorEscala).toFixed(2));
      logger.info(`📊 Score calculado: ${scoreFinal}`);

      const resultadoFormateado = {
        nombreAnalizador: this.nombreRed,
        score: scoreFinal,
        detalles: {
          mensaje:
            scoreFinal >= 8
              ? "Características predominantemente humanas."
              : scoreFinal <= 3
              ? "Características predominantemente sintéticas (IA)."
              : "Características intermedias.",
        },
      };

      // Enviar el resultado al servidor central si la conexión está activa
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(
          JSON.stringify({
            red: this.nombreRed,
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

export default RedNeuronalBasica;
