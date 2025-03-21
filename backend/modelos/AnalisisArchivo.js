import mongoose from "mongoose";

const AnalisisArchivoSchema = new mongoose.Schema({
  usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: "Usuario", required: true },
  nombreArchivo: { type: String, required: true },
  tipo: { type: String, enum: ["imagen", "pdf"], required: true },
  resultado: {
    esIA: { type: Boolean, required: true },
    probabilidadIA: { type: Number, min: 0, max: 1 }
  },
  informePDF: { type: String }, // Ruta del informe PDF para premium
  fechaAnalisis: { type: Date, default: Date.now }
});

const AnalisisArchivo = mongoose.model("AnalisisArchivo", AnalisisArchivoSchema);
export default AnalisisArchivo;
