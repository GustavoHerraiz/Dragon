import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Usuario from "../modelos/Usuario.js";

const router = express.Router();

// 📌 REGISTRO DE USUARIO
router.post("/registro", async (req, res) => {
    try {
        const { nombre, email, password } = req.body; // 👈 Eliminamos "tipo" del cuerpo del request
        console.log("📥 Datos recibidos:", req.body);

        // Verificar si el usuario ya existe
        const usuarioExistente = await Usuario.findOne({ email });
        if (usuarioExistente) {
            return res.status(400).json({ error: "El email ya está registrado." });
        }

        // Hash de la contraseña
        const salt = await bcrypt.genSalt(10);
        const hashContraseña = await bcrypt.hash(password, salt);

        // Crear nuevo usuario con tipo "user" por defecto
        const nuevoUsuario = new Usuario({ nombre, email, password: hashContraseña, tipo: "user" }); // 👈 Ahora el tipo siempre es "user"
        await nuevoUsuario.save();

        console.log("✅ Usuario registrado:", nuevoUsuario);
        res.status(201).json({ mensaje: "Usuario registrado correctamente" });
    } catch (error) {
        console.error("🔴 Error en el registro:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
});



// 📌 LOGIN DE USUARIO
router.post("/login", async (req, res) => {
    try {
        const { email, contraseña } = req.body;

        // Verificar si el usuario existe
        const usuario = await Usuario.findOne({ email });
        if (!usuario) {
            return res.status(400).json({ error: "El email no está registrado." });
        }

        // Verificar la contraseña
        const contraseñaValida = await bcrypt.compare(contraseña, usuario.contraseña);
        if (!contraseñaValida) {
            return res.status(400).json({ error: "Contraseña incorrecta." });
        }

        // Generar un token de autenticación
        const token = jwt.sign({ id: usuario._id, tipo: usuario.tipo }, process.env.JWT_SECRET, { expiresIn: "24h" });

        res.status(200).json({ mensaje: "Inicio de sesión exitoso", token });
    } catch (error) {
        console.error("🔴 Error en el login:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
});

// 📌 VERIFICAR AUTENTICACIÓN
router.get("/verificar", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) return res.status(401).json({ error: "Acceso no autorizado" });

        jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
            if (err) return res.status(403).json({ error: "Token inválido" });

            const usuario = await Usuario.findById(decoded.id).select("-contraseña");
            res.json(usuario);
        });
    } catch (error) {
        res.status(500).json({ error: "Error verificando el usuario" });
    }
});

export default router;
