import mongoose from "mongoose";

const AuditoriaSchema = new mongoose.Schema({
  tipo_evento: { type: String, required: true },
  usuario_id: { type: mongoose.Schema.Types.ObjectId, ref: "Usuario" },
  admin_id: { type: mongoose.Schema.Types.ObjectId, ref: "Administrador" },
  detalle: { type: String },
  fecha: { type: Date, default: Date.now }
});

const Auditoria = mongoose.model("Auditoria", AuditoriaSchema);
export default Auditoria;
