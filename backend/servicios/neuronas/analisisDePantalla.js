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
    new winston.transports.File({ filename: "./logs/redAnalisisPantalla.log" }),
  ],
});

// Parámetros ordenados y pesos
const parametros = [
  { nombre: "Formato", peso: 0.1, esPantalla: (valor) => valor === "JPEG" || valor === "PNG" },
  { nombre: "Ancho", peso: 0.1, esPantalla: (valor) => valor > 0.3 && valor < 0.7 },
  { nombre: "Alto", peso: 0.1, esPantalla: (valor) => valor > 0.3 && valor < 0.7 },
  { nombre: "Resolución", peso: 0.15, esPantalla: (valor) => valor < 0.5 },
  { nombre: "Proporción de Dimensiones", peso: 0.1, esPantalla: (valor) => valor > 0.4 && valor < 0.8 },
  { nombre: "Artefactos Detectados", peso: 0.15, esPantalla: (valor) => valor > 0.5 },
  { nombre: "Software Utilizado", peso: 0.1, esPantalla: (valor) => valor !== "Desconocido" },
  { nombre: "Fecha de Creación", peso: 0.05, esPantalla: (valor) => valor !== null },
  { nombre: "Fecha de Modificación", peso: 0.05, esPantalla: (valor) => valor !== null },
  { nombre: "Dimensiones Exif", peso: 0.1, esPantalla: (valor) => valor !== "No disponible" },
];

// Clase principal: RedAnalisisPantalla
class RedAnalisisPantalla {
  constructor() {
    try {
      const rawData = fs.readFileSync(path.join(__dirname, "RedDePantalla_Entrenada.json"), "utf8");
      this.network = synaptic.Network.fromJSON(JSON.parse(rawData));
      logger.info("✅ Modelo cargado desde RedDePantalla_Entrenada.json correctamente.");
    } catch (error) {
      logger.error(`❌ Error al cargar el modelo: ${error.message}`);
      this.network = new synaptic.Architect.Perceptron(10, 5, 1);
      logger.info("⚠️ Red neuronal inicializada por defecto.");
    }
    this.conectarConServidor();
  }

  conectarConServidor() {
    const socket = new WebSocket("ws://localhost:8080");

    socket.on("open", () => {
      logger.info("🔗 Conexión con el servidor central establecida.");
      socket.send(
        JSON.stringify({
          red: "redAnalisisPantalla",
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
            const parametro = parametros.find((p) => p.nombre === orden.parametro);
            if (parametro && orden.nuevo_valor) {
              parametro.peso = orden.nuevo_valor;
              logger.info(`✅ Peso actualizado: ${orden.parametro} → ${orden.nuevo_valor}`);
            }
          });

          socket.send(
            JSON.stringify({
              tipo: "confirmacion",
              mensaje: "Órdenes ejecutadas con éxito.",
              detalles: respuesta.ordenes,
            })
          );
        }
      } catch (error) {
        logger.error(`❌ Error al procesar mensaje: ${error.message}`);
      }
    });

    socket.on("close", () => {
      logger.warn("🔌 Conexión cerrada. Reintentando...");
      setTimeout(() => this.conectarConServidor(), 5000);
    });

    this.socket = socket;
  }

  analizar(datos) {
    try {
      logger.info("📥 Datos recibidos para el análisis:");
      logger.info(JSON.stringify(datos, null, 2));

      datos = datos.map((dato) => (isNaN(dato) || dato === null ? 0 : dato));

      let scorePonderado = 0;
      parametros.forEach((parametro, i) => {
        const valor = datos[i];
        const valorAjustado = parametro.nombre === "Resolución" || parametro.nombre === "Fecha de Creación" || parametro.nombre === "Fecha de Modificación"
          ? 1 - valor // Aplicar lógica inversa para valores bajos = Humano
          : parametro.nombre === "Formato" || parametro.nombre === "Software Utilizado"
          ? valor // Dejar valores altos = IA como están
          : valor; // No ajustar para otros valores

        const esPantalla = parametro.esPantalla(valorAjustado) ? 1 : 0;
        scorePonderado += esPantalla * parametro.peso;

        logger.info(`🔍 ${parametro.nombre}: Valor=${valor}, Ajustado=${valorAjustado}, Pantalla=${esPantalla}, Peso=${parametro.peso}`);
      });

      const scoreFinal = parseFloat(((1 - scorePonderado) * 10).toFixed(2));

      const resultadoFormateado = {
        nombreAnalizador: "redAnalisisPantalla",
        descripcion: "Análisis de pantallas y fotografías de monitor.",
        score: scoreFinal,
        metadatos: {
          formato: datos[0],
          dimensiones: `${datos[1]}x${datos[2]}`,
          resolucion: datos[3],
          proporcion: datos[4],
          artefactos: datos[5],
          software: datos[6],
          fechas: {
            creacion: datos[7],
            modificacion: datos[8],
          },
          dimensionesExif: datos[9],
        },
        detalles: {
          mensaje:
            scoreFinal >= 8
              ? "La imagen parece confiable y original."
              : scoreFinal <= 3
              ? "La imagen parece una foto de pantalla sospechosa."
              : "La imagen presenta características mixtas.",
        },
      };

      logger.info("📄 Resultado formateado:");
      logger.info(JSON.stringify(resultadoFormateado, null, 2));

      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(
          JSON.stringify({
            red: "redAnalisisPantalla",
            salida: resultadoFormateado.score,
            detalles: resultadoFormateado.detalles,
          })
        );
        logger.info("📤 Resultado enviado al servidor central.");
      } else {
        logger.warn("⚠️ Conexión no activa, resultado no enviado.");
      }

      return resultadoFormateado;
    } catch (error) {
      logger.error(`❌ Error durante el análisis: ${error.message}`);
      return { error: error.message };
    }
  }
}

export default RedAnalisisPantalla;
