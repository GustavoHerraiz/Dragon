import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from 'uuid';
import conectarDB from "./config/database.js";
import authRoutes from "./rutas/auth.js";
import archivosRoutes from "./rutas/archivos.js";
import { analizarImagen } from "./servicios/analizadorImagen.js";
import winston from "winston";
import fs from "fs";
import jwt from "jsonwebtoken";
import Usuario from "./modelos/Usuario.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;
console.log("📌 MONGODB_URI:", process.env.MONGODB_URI);

// 📌 Configuración de __dirname para ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 📌 Configuración de Winston para logging
const logger = winston.createLogger({
    level: "info",
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
            const logMessage = `${timestamp} [${level.toUpperCase()}]: ${message}`;
            console.log(logMessage);
            return logMessage;
        })
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: "./logs/server.log" })
    ]
});

// 📌 Conectar a la base de datos
conectarDB()
    .then(() => logger.info("🟢 Conectado a MongoDB Atlas"))
    .catch(err => logger.error(`🔴 Error conectando a MongoDB: ${err.message}`));

// 📌 Configurar CORS para aceptar peticiones desde el frontend
app.use(cors({
  origin: "https://www.bladecorporation.net", // ⚠️ Asegúrate de que es el dominio correcto
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}))



// 📌 Middleware de autenticación
const autenticarUsuario = async (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No autorizado" });
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const usuario = await Usuario.findById(decoded.id);
        if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });
        req.user = usuario;
        next();
    } catch (error) {
        logger.error(`🔴 Error de autenticación: ${error.message}`);
        res.status(403).json({ error: "Token inválido" });
    }
};

// 📌 Configurar almacenamiento de Multer
const uploadPath = path.join(__dirname, "uploads/");
if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const userId = req.user ? req.user._id.toString() : 'anonimo';
        const fileId = uuidv4();
        const nombreUnico = `${userId}-${fileId}${ext}`;
        cb(null, nombreUnico);
    }
});

// 📌 Filtros de archivos permitidos
const fileFilter = (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        logger.warn(`🔴 Archivo rechazado: ${file.originalname} - Tipo no permitido`);
        cb(new Error("Tipo de archivo no permitido"), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 50 * 1024 * 1024 }
});

// 📌 Middleware de logs para cada solicitud
app.use((req, res, next) => {
    logger.info(`📥 [${req.method}] ${req.url}`);
    next();
});

// 📌 Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, "../frontend")));

app.post("/subir-publico", upload.array("archivos", 5), (req, res) => {
    try {
        console.log("📥 Recibiendo archivos:", req.files); // Log para depuración

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: "No se ha subido ningún archivo." });
        }

        const archivosGuardados = req.files.map(file => ({
            nombre: file.filename,
            tipo: file.mimetype,
            tamaño: file.size
        }));

        console.log("✅ Archivos subidos correctamente:", archivosGuardados);
        res.json({ mensaje: "Archivos subidos correctamente", archivos: archivosGuardados });
    } catch (error) {
        console.error("🔴 Error en /subir-publico:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
});

// 📌 Nueva ruta para entrenar el sistema
app.post("/guardar-entrenamiento", upload.single("archivo"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No se ha subido ningún archivo." });
        }

        const etiqueta = req.body.etiqueta;
        if (!["humano", "ai"].includes(etiqueta)) {
            return res.status(400).json({ error: "Etiqueta no válida." });
        }

        const destino =
            etiqueta === "humano"
                ? "/var/www/ProyectoDragon/backend/servicios/entrenamiento/humanos"
                : "/var/www/ProyectoDragon/backend/servicios/entrenamiento/ai";

        const filePath = path.join(destino, req.file.originalname);

        fs.rename(req.file.path, filePath, async (err) => {
            if (err) {
                logger.error(`🔴 Error al mover archivo: ${err.message}`);
                return res.status(500).json({ error: "Error al guardar el archivo." });
            }

            logger.info(`✅ Archivo guardado en ${destino}`);

            try {
                const resultadoAnalisis = await analizarImagen(filePath);
                logger.info(`📊 Resultado del análisis: ${JSON.stringify(resultadoAnalisis)}`);

                // Redirigir al usuario a analizar-imagen-publico.html con los resultados
                res.send(`
                    <script>
                        localStorage.setItem('resultadoAnalisis', JSON.stringify(${JSON.stringify(resultadoAnalisis)}));
                        window.location.href = "/analizar-imagen-publico.html";
                    </script>
                `);
            } catch (error) {
                logger.error(`🔴 Error al analizar archivo: ${error.message}`);
                res.status(500).json({ error: "Error al analizar el archivo." });
            }
        });
    } catch (error) {
        logger.error(`🔴 Error en guardar-entrenamiento: ${error.message}`);
        res.status(500).json({ error: "Error en el servidor." });
    }
});




app.post("/analizar-imagen-publico", upload.single("archivo"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No se ha subido ningún archivo." });
        }

        const filePath = path.join(uploadPath, req.file.filename);
        const resultado = await analizarImagen(filePath);

        // Enviar un script al frontend para almacenar en localStorage y redirigir
        res.send(`
            <script>
                localStorage.setItem('resultadoAnalisis', JSON.stringify(${JSON.stringify(resultado)}));
                window.location.href = "/analizar-imagen-publico.html";
            </script>
        `);
    } catch (error) {
        res.status(500).json({ error: "Error en el servidor" });
    }
});






// 📌 Rutas de autenticación y archivos
app.use("/auth", authRoutes);
app.use("/archivos", archivosRoutes);

// 📌 Ruta de subida de archivos con autenticación
app.post("/subir", autenticarUsuario, upload.array("archivos", 5), (req, res) => {
    try {
        logger.info("📥 Intentando subir archivos...");

        if (!req.files || req.files.length === 0) {
            logger.warn("🔴 No se ha subido ningún archivo.");
            return res.status(400).json({ error: "No se ha subido ningún archivo." });
        }

        const archivosGuardados = req.files.map(file => ({
            nombre: file.filename,
            tipo: file.mimetype,
            tamaño: file.size
        }));

        logger.info(`✅ Archivos subidos: ${archivosGuardados.map(a => a.nombre).join(", ")}`);
        res.json({ mensaje: "Archivos subidos correctamente", archivos: archivosGuardados });

    } catch (error) {
        logger.error(`🔴 Error en la subida: ${error.message}`);
        res.status(500).json({ error: "Error en el servidor" });
    }
});

// 📌 Ruta para analizar imágenes con autenticación
app.post("/analizar-imagen", autenticarUsuario, upload.single("archivo"), async (req, res) => {
    try {
        logger.info("📥 Recibida solicitud de análisis de imagen");

        if (!req.file) {
            logger.warn("🔴 No se ha subido ningún archivo.");
            return res.status(400).json({ error: "No se ha subido ningún archivo." });
        }

        const filePath = path.join(uploadPath, req.file.filename);
        logger.info(`📂 Analizando imagen: ${req.file.filename}`);

        // 📌 Llamamos a analizarImagen y obtenemos los metadatos
        const resultado = await analizarImagen(filePath);

        // 📢 Ahora sí, imprimimos el resultado después de recibirlo
        console.log("📤 Resultado recibido en server.js:", JSON.stringify(resultado, null, 2));

        logger.info(`📤 Resultado enviado al cliente: ${JSON.stringify(resultado)}`);

        res.json({
            mensaje: "Análisis completado",
            resultado,
            nombreArchivo: req.file.filename // Para referencia del frontend
        });

    } catch (error) {
        logger.error(`🔴 Error en el análisis: ${error.message}`);
        res.status(500).json({ error: "Error en el servidor" });
    }
});




// 📌 Ruta para verificar autenticación
app.get("/auth/verificar", autenticarUsuario, async (req, res) => {
    try {
        const usuario = await Usuario.findById(req.user._id).select("-contraseña");
        res.json(usuario);
    } catch (error) {
        logger.error(`🔴 Error verificando usuario: ${error.message}`);
        res.status(500).json({ error: "Error en el servidor" });
    }
});

// 📌 Capturar errores globales
app.use((err, req, res, next) => {
    logger.error(`🔴 Error en Express: ${err.message}`);
    res.status(500).json({ error: "Error interno del servidor" });
});

// 📌 Iniciar servidor
app.listen(PORT, () => {
    logger.info(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
