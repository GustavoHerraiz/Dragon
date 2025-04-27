import synaptic from "synaptic";
import winston from "winston";
import fs from "fs";
import WebSocket from "ws"; // Importación de WebSocket
import path from "path";
import { fileURLToPath } from "url";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración del logger
const logger = winston.createLogger({
  level: "info",
  transports: [
    new winston.transports.Console({ format: winston.format.simple() }),
    new winston.transports.File({ filename: "./logs/redAnalisisFirmasDigitales.log" }),
  ],
});


// Parámetros ordenados y pesos
const parametros = [
  { nombre: "Software Detectado", peso: 0.3, esHumano: (valor) => valor < 0.7 },
  { nombre: "Marca Cámara", peso: 0.2, esHumano: (valor) => valor !== 0 },
  { nombre: "Modelo Cámara", peso: 0.2, esHumano: (valor) => valor !== 0 },
  { nombre: "Fecha de Captura", peso: 0.15, esHumano: (valor) => valor !== 0 },
  { nombre: "Fecha de Modificación", peso: 0.15, esHumano: (valor) => valor !== 0 },
];

// Función para limpiar nombres de software y eliminar versiones
const limpiarNombreSoftware = (nombreSoftware) => {
  if (typeof nombreSoftware !== "string" || !nombreSoftware.trim()) return "Indeterminado"; // Valor predeterminado
  return nombreSoftware.replace(/[\d.]+$/g, "").trim();
};


// Mapeo de versiones detectadas a software legítimo
const softwareEdicion = {
  fotografiaProfesional: [
    "Adobe Photoshop", "Lightroom", "Capture One", "DxO PhotoLab", "ON1 Photo RAW",
    "Luminar", "ACDSee", "PaintShop Pro", "Pixelmator", "RawTherapee", "Darktable",
    "Exposure X", "PhotoScape", "PhotoDirector"
  ],
  ilustracionYDisenoGrafico: [
    "Affinity Photo", "GIMP", "CorelDRAW", "Krita", "Sketch", "Inkscape", "ArtRage",
    "MediBang Paint Pro"
  ],
  edicionVideoYPostproduccion: [
    "After Effects", "Final Cut Pro", "DaVinci Resolve", "Blackmagic Fusion",
    "HitFilm Express", "Natron"
  ],
  diseno3DYTexturizado: [
    "Autodesk Maya", "Cinema 4D", "Blender", "ZBrush", "Substance Painter",
    "Marmoset Toolbag", "Nuke", "Mari", "Houdini", "3D-Coat"
  ],
  edicionMovil: [
    "Apple Photos", "PicsArt", "BeFunky", "Fotor", "iPiccy", "Ribbet", "Sumo Paint",
    "YouCam Perfect", "Phonto", "Snapseed", "VSCO", "Polarr", "Prisma",
    "Superimpose X", "Enlight Photofox", "TouchRetouch", "Facetune",
    "Darkroom", "Mextures", "Afterlight", "RNI Films", "Filmborn",
    "A Color Story", "Tezza", "Foodie", "Huji Cam", "Unfold",
    "InShot", "Canva"
  ]
};

// Clase de la red
class RedAnalisisFirmasDigitales {
  constructor() {
    try {
      const rawData = fs.readFileSync(path.join(__dirname, "RedDeFirmasDigitales_Entrenada.json"), "utf8");
      this.network = synaptic.Network.fromJSON(JSON.parse(rawData));
      logger.info("✅ Modelo cargado desde RedDeFirmasDigitales_Entrenada.json correctamente.");
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
    this.socket = socket; // Almacena el socket en la instancia de la clase

    logger.info("🔗 Intentando conectar con el servidor central...");

    socket.on("open", () => {
      logger.info("🔗 Conexión con el servidor central establecida.");
      socket.send(
        JSON.stringify({
          red: "analisisDeFirmasDigitales",
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
          logger.info("🔧 Ejecutando órdenes obligatorias del servidor central...");
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
        logger.error(`❌ Error al procesar el mensaje recibido: ${error.message}`);
      }
    });

    socket.on("close", () => {
      logger.warn("🔌 Conexión cerrada con el servidor central. Intentando reconectar en 5 segundos...");
      setTimeout(() => this.conectarConServidor(), 5000);
    });
  }



  analizar(datos, softwareFirmasDigitales) {
  try {
    logger.info("📣 Método `analizar` invocado.");
    logger.info("📥 Datos recibidos para el análisis:");
    logger.info(JSON.stringify(datos, null, 2));

    // Validar los datos recibidos
    if (!datos || datos.length === 0) {
      logger.warn("⚠️ Los datos recibidos están vacíos o no válidos.");
      return { error: "Datos no válidos." };
    }

    // Limpieza de datos
    datos = datos.map((dato, index) => {
      if (index === 1 || index === 3 || index === 4) return dato; // Preserva cadenas en índices relevantes
      return isNaN(dato) || dato === null ? 0 : dato;
    });

    logger.info(`📋 Datos después de limpieza: ${JSON.stringify(datos)}`);

    // Incorporar `softwareFirmasDigitales` directamente
    if (softwareFirmasDigitales) {
      logger.info("📦 Incorporando `softwareFirmasDigitales` en la evaluación...");
      logger.info("📋 Datos de la variable `softwareFirmasDigitales` antes del procesamiento:");
      logger.info(JSON.stringify(softwareFirmasDigitales, null, 2));

      const { softwareDetectado, confiabilidad, tipoFirma, metadatos } = softwareFirmasDigitales;

      // Actualizar índices relevantes en `datos`
      datos[1] = softwareDetectado || "No disponible"; // Software detectado
      datos[2] = metadatos.modelo || "No disponible"; // Modelo de cámara
      datos[3] = metadatos.fechaOriginal || "No disponible"; // Fecha original
      datos[4] = metadatos.fechaModificacion || "No disponible"; // Fecha modificación

      logger.info("📋 Datos actualizados con `softwareFirmasDigitales`:");
      logger.info(JSON.stringify(datos, null, 2));
    }

    // Proceso de la red neuronal
    logger.info("⚙️ Procesando datos con la red neuronal...");
    const resultado = this.network.activate(datos);

    let scorePonderado = 0;
    parametros.forEach((parametro, i) => {
      const valor = datos[i];
      const esHumano = parametro.esHumano(valor) ? 1 : 0;
      scorePonderado += esHumano * parametro.peso;
      logger.info(`🔍 ${parametro.nombre}: Valor=${valor}, Humano=${esHumano}, Peso=${parametro.peso}`);
    });

    let scoreFinal = parseFloat(((1 - scorePonderado) * 10).toFixed(2));

    // Refuerzo de puntuación basado en confiabilidad
    if (softwareFirmasDigitales?.confiabilidad) {
      const puntuacionRefuerzo = parseFloat((softwareFirmasDigitales.confiabilidad * 10).toFixed(2));
      scoreFinal = Math.max(scoreFinal, puntuacionRefuerzo);
      logger.info(`🔧 Refuerzo del puntaje basado en confiabilidad: ${puntuacionRefuerzo}`);
    }

    const resultadoFormateado = {
      nombreAnalizador: "analizadorFirmasDigitales",
      descripcion: "Análisis de firmas digitales en los metadatos EXIF.",
      score: scoreFinal,
      metadatos: {
        softwareDetectado: datos[1],
        marcaCamara: datos[2],
        modeloCamara: datos[2],
        fechaCaptura: datos[3],
        fechaModificacion: datos[4],
      },
      detalles: {
        mensaje: softwareFirmasDigitales?.tipoFirma === "Software legítimo (Humano)"
          ? `Los metadatos indican una imagen auténtica con software legítimo: ${datos[1]}.`
          : scoreFinal <= 3
          ? `Se detectó una firma digital sospechosa. Software: ${datos[1]}.`
          : `Los metadatos muestran características intermedias. Software: ${datos[1]}.`,
      },
    };

    logger.info("📄 Resultado formateado para el sistema:");
    logger.info(JSON.stringify(resultadoFormateado, null, 2));

    // Enviar al servidor central
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          red: "analisisDeFirmasDigitales",
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

export default RedAnalisisFirmasDigitales;
