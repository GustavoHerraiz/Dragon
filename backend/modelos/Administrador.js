import mongoose from "mongoose";

const AdministradorSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  hash_contraseña: { type: String, required: true },
  permisos: { type: [String], enum: ["usuarios", "archivos", "auditoria"], default: ["usuarios", "archivos", "auditoria"] },
  fechaRegistro: { type: Date, default: Date.now }
});

const Administrador = mongoose.model("Administrador", AdministradorSchema);
export default Administrador;
