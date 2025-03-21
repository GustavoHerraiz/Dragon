import winston from "winston";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

// Obtiene la ruta del archivo actual y su directorio
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ruta del directorio de logs
const logDirectory = path.join(__dirname, "../logs");

// Verifica que el directorio de logs existe; si no, lo crea
try {
    if (!fs.existsSync(logDirectory)) {
        fs.mkdirSync(logDirectory, { recursive: true });
    }
} catch (error) {
    console.error("Error creando el directorio de logs:", error.message);
}

// Configuración y creación del logger con Winston
export const logger = winston.createLogger({
    level: "info",
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
            return `${timestamp} [${level.toUpperCase()}]: ${message}`;
        })
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({
            filename: path.join(logDirectory, "server.log"),
            maxsize: 5 * 1024 * 1024, // 5MB
            handleExceptions: true
        })
    ],
    exitOnError: false // No finalizar en caso de error
});

// Maneja excepciones no controladas específicamente para el logger
logger.exceptions.handle(
    new winston.transports.File({ filename: path.join(logDirectory, "exceptions.log") })
);

// Maneja rechazos de promesas no controladas
logger.rejections.handle(
    new winston.transports.File({ filename: path.join(logDirectory, "rejections.log") })
);

// Implementación de la función "analizar"
export const analizar = async (mensaje) => {
    const resultado = {
        mensaje: mensaje || "Análisis de logs ejecutado.",
        logs: []
    };

    try {
        logger.info(resultado.mensaje);
        resultado.logs.push("Log registrado exitosamente.");
    } catch (error) {
        resultado.logs.push(`Error durante el registro de logs: ${error.message}`);
        logger.error(`Error durante el análisis: ${error.message}`);
    }

    return resultado;
};
