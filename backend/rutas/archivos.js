import express from "express";
import multer from "multer";
import path from "path";
import { ObjectId } from "mongodb";
import fs from "fs";
import Usuario from "../modelos/Usuario.js";
import AnalisisArchivo from "../modelos/AnalisisArchivo.js";
import { analizarImagen } from "../servicios/analizadorImagen.js";
import { extraerTextoPDF } from "../servicios/analizadorPDF.js";
import winston from "winston";
import jwt from "jsonwebtoken";

const router = express.Router();

// 📌 Configuración de Winston para logging
const logger = winston.createLogger({
    level: "info",
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
            return `${timestamp} [${level.toUpperCase()}]: ${message}`;
        })
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: "./logs/archivos.log", level: "info" })
    ]
});

// 📌 Configuración de almacenamiento con `multer`
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = "./uploads/";
        if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${Date.now()}-${file.fieldname}${ext}`);
    }
});
// 📌 Obtener archivos analizados por el usuario
router.get("/mis-archivos", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) return res.status(401).json({ error: "No autorizado" });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const archivos = await AnalisisArchivo.find({ usuarioId: decoded.id });

        res.json(archivos);
    } catch (error) {
        console.error("🔴 Error obteniendo archivos:", error);
        res.status(500).json({ error: "Error en el servidor" });
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

// 📌 Configurar `multer`
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB máximo por archivo
});

// 📌 SUBIR ARCHIVOS (Múltiples Archivos Permitidos)
router.post("/subir", upload.array("archivos", 5), async (req, res) => {
    try {
        logger.info("📥 Intentando subir archivos...");

        let usuarioId = null;
        let usuarioTipo = "express"; // Por defecto, usuarios exprés

        // 📌 Verificar si el usuario envió un token JWT válido
        const token = req.headers.authorization?.split(" ")[1];
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                usuarioId = decoded.id;
                usuarioTipo = "registrado";
                logger.info(`🟢 Usuario autenticado: ID ${usuarioId}`);
            } catch (error) {
                logger.warn("🔴 Token inválido, el usuario sigue como express.");
            }
        }

        if (!req.files || req.files.length === 0) {
            logger.warn("🔴 No se ha subido ningún archivo.");
            return res.status(400).json({ error: "No se ha subido ningún archivo." });
        }

        let archivosGuardados = req.files.map(file => ({
            usuarioId,
            usuarioTipo,
            nombre: file.filename,
            tipo: file.mimetype,
            tamaño: file.size
        }));

        logger.info(`✅ Archivos subidos correctamente: ${archivosGuardados.map(a => a.nombre).join(", ")}`);

        res.json({ mensaje: "Archivos subidos correctamente", archivos: archivosGuardados });

    } catch (error) {
        logger.error(`🔴 Error en la subida de archivos: ${error.message}`);
        res.status(500).json({ error: "Error en el servidor" });
    }
});

// 📌 SERVICIO PARA ANALIZAR IMÁGENES
router.post("/analizar-imagen", upload.single("archivo"), async (req, res) => {
    try {
        if (!req.file) {
            logger.warn("🔴 No se ha subido ningún archivo.");
            return res.status(400).json({ error: "No se ha subido ningún archivo." });
        }

        logger.info(`📤 Analizando imagen: ${req.file.filename}`);

        const resultado = await analizarImagen(req.file.path);
        res.json({ mensaje: "Análisis completado", resultado });

    } catch (error) {
        logger.error(`🔴 Error analizando imagen: ${error.message}`);
        res.status(500).json({ error: "Error en el análisis de la imagen" });
    }
});

// 📌 SERVICIO PARA ANALIZAR PDFs
router.post("/analizar-pdf", upload.single("archivo"), async (req, res) => {
    try {
        if (!req.file) {
            logger.warn("🔴 No se ha subido ningún archivo.");
            return res.status(400).json({ error: "No se ha subido ningún archivo." });
        }

        logger.info(`📤 Analizando PDF: ${req.file.filename}`);

        const resultado = await extraerTextoPDF(req.file.path);
        res.json({ mensaje: "Análisis de PDF completado", resultado });

    } catch (error) {
        logger.error(`🔴 Error analizando PDF: ${error.message}`);
        res.status(500).json({ error: "Error en el análisis del PDF" });
    }
});

export default router;
