import mongoose from "mongoose";

const UsuarioSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  contraseña: { type: String, required: true },
  tipo: { type: String, enum: ["express", "normal", "premium"], default: "normal" },
  creditos: { type: Number, default: 5 }, // Créditos de análisis para usuarios normales
  fechaRegistro: { type: Date, default: Date.now }
});

const Usuario = mongoose.model("Usuario", UsuarioSchema);
export default Usuario;
