import synaptic from "synaptic";
import winston from "winston";
import fs from "fs";
import WebSocket from "ws";
import { fileURLToPath } from "url";
import path from "path";
import { performance } from 'perf_hooks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración mejorada del logger
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({ 
      format: winston.format.simple(),
      handleExceptions: true 
    }),
    new winston.transports.File({ 
      filename: "./logs/redAnalisisColor.log",
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    new winston.transports.File({ 
      filename: "./logs/redAnalisisColor_error.log", 
      level: "error",
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

const parametros = [
  { nombre: "Rojo Dominante", peso: 0.1, esHumano: (valor) => valor > 0.2 && valor < 0.8 },
  { nombre: "Verde Dominante", peso: 0.1, esHumano: (valor) => valor > 0.2 && valor < 0.8 },
  { nombre: "Azul Dominante", peso: 0.1, esHumano: (valor) => valor > 0.2 && valor < 0.8 },
  { nombre: "Balance Cromático", peso: 0.15, esHumano: (valor) => valor > 0.4 && valor < 0.7 },
  { nombre: "Espacio de Color Válido", peso: 0.1, esHumano: (valor) => valor === 1 },
  { nombre: "Rango del Espacio de Color", peso: 0.1, esHumano: (valor) => valor === 1 },
  { nombre: "Balance de Blancos", peso: 0.1, esHumano: (valor) => valor === 1 },
  { nombre: "Saturación", peso: 0.1, esHumano: (valor) => valor > 0.3 && valor < 0.8 },
  { nombre: "Contraste", peso: 0.1, esHumano: (valor) => valor > 0.3 && valor < 0.8 },
  { nombre: "Presencia de Software", peso: 0.05, esHumano: (valor) => valor === 1 },
];

class RedAnalisisColor {
  constructor() {
    // Métricas existentes mejoradas
    this.metricas = {
      totalAnalisis: 0,
      errores: 0,
      tiempoTotal: 0,
      memoriaInicial: process.memoryUsage().heapUsed,
      ultimoCheckMemoria: Date.now()
    };

    try {
      const rutaModelo = path.join(__dirname, "RedDeColor_Entrenada.json");
      const rawData = fs.readFileSync(rutaModelo, "utf8");
      this.network = synaptic.Network.fromJSON(JSON.parse(rawData));
      logger.info("✅ Modelo cargado desde RedDeColor_Entrenada.json correctamente.");
    } catch (error) {
      logger.error(`❌ Error al cargar el modelo: ${error.message}`, { 
        error: error.stack 
      });
      this.network = new synaptic.Architect.Perceptron(10, 5, 1);
      logger.info("⚠️ Red neuronal inicializada por defecto.");
    }

    // Iniciar monitoreo de memoria
    this.iniciarMonitoreoMemoria();

    logger.info("🌐 Iniciando conexión con el servidor central...");
    this.conectarConServidor();
  }

  iniciarMonitoreoMemoria() {
    this.checkMemoria = setInterval(() => {
      const memoriaActual = process.memoryUsage().heapUsed;
      const incrementoMB = Math.round((memoriaActual - this.metricas.memoriaInicial) / 1024 / 1024);
      
      if (incrementoMB > 100) {
        logger.warn(`📊 Alto uso de memoria: ${incrementoMB}MB sobre la inicial`, {
          memoriaInicial: Math.round(this.metricas.memoriaInicial / 1024 / 1024),
          memoriaActual: Math.round(memoriaActual / 1024 / 1024),
          incremento: incrementoMB
        });
      }

      this.metricas.ultimoCheckMemoria = Date.now();
    }, 300000); // 5 minutos
  }

  conectarConServidor() {
    const socket = new WebSocket("ws://localhost:8080");

    logger.info("🔗 Intentando conectar con el servidor central...");

    socket.on("open", () => {
      logger.info("🔗 Conexión con el servidor central establecida.");
      socket.send(
        JSON.stringify({
          red: "analisisDeColor",
          salida: 1,
          detalles: { mensaje: "Conexión inicial exitosa." },
        })
      );
    });

    socket.on("error", (error) => {
      logger.error(`❌ Error en la conexión WebSocket: ${error.message}`, {
        error: error.stack
      });
    });

    socket.on("message", (message) => {
      try {
        const respuesta = JSON.parse(message);
        logger.info(`📨 Mensaje recibido del servidor central: ${JSON.stringify(respuesta)}`);

        if (respuesta.tipo === "orden" && respuesta.ordenes) {
          logger.info("🔧 Ejecutando órdenes del servidor central...");
          respuesta.ordenes.forEach((orden) => {
            logger.info(`🔄 Aplicando ${orden.parametro} a ${orden.nuevo_valor || orden.mensaje}`);
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
        logger.error(`❌ Error al procesar el mensaje recibido: ${error.message}`, {
          error: error.stack
        });
      }
    });

    socket.on("close", () => {
      logger.warn("🔌 Conexión cerrada con el servidor central. Intentando reconectar en 5 segundos...");
      setTimeout(() => this.conectarConServidor(), 5000);
    });

    this.socket = socket;
  }

  analizar(datos) {
    const inicioProceso = performance.now();
    
    try {
      logger.info("📥 Datos recibidos para el análisis:", {
        longitud: datos?.length,
        tipo: typeof datos
      });

      if (!Array.isArray(datos)) {
        logger.warn("⚠️ Formato de datos no óptimo - intentando conversión");
        datos = Array.from(datos);
      }

      datos = datos.map((dato) => Math.max(0, Math.min(1, parseFloat(dato))));

      logger.info("⚙️ Procesando datos transformados con la red neuronal...");
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
        nombreAnalizador: "analizadorColor",
        descripcion: "Análisis de la composición cromática de la imagen.",
        score: scoreFinal,
        metadatos: {
          coloresDominantes: datos.slice(0, 3),
          balanceCromático: datos[3],
          espacioColorValido: datos[4],
        },
        detalles: {
          mensaje:
            scoreFinal >= 8
              ? "La imagen presenta una composición cromática rica y equilibrada."
              : scoreFinal <= 3
              ? "La imagen presenta irregularidades cromáticas o signos de manipulación."
              : "La imagen tiene características cromáticas intermedias.",
        },
      };

      // Actualizar métricas
      const tiempoProceso = performance.now() - inicioProceso;
      this.metricas.totalAnalisis++;
      this.metricas.tiempoTotal += tiempoProceso;

      // Métricas extendidas
      logger.info("📊 Métricas de proceso", {
        tiempo_ms: tiempoProceso.toFixed(2),
        p95: (this.metricas.tiempoTotal / this.metricas.totalAnalisis).toFixed(2),
        error_rate: ((this.metricas.errores / this.metricas.totalAnalisis) * 100).toFixed(2),
        memoria_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
      });

      logger.info("📄 Resultado formateado para el sistema:", resultadoFormateado);

      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(
          JSON.stringify({
            red: "analisisDeColor",
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
      this.metricas.errores++;
      logger.error(`❌ Error durante el análisis: ${error.message}`, {
        error: error.stack,
        datos_tipo: typeof datos,
        datos_length: datos?.length
      });
      return {
        error: "Ocurrió un error durante el análisis.",
        detalles: { mensaje: error.message },
      };
    }
  }
}

export default RedAnalisisColor;
