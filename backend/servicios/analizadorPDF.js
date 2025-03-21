import pdf from "pdf-parse";
import fs from "fs";

export const extraerTextoPDF = async (rutaArchivo) => {
    try {
        if (!fs.existsSync(rutaArchivo)) {
            console.error(`🔴 Error: El archivo ${rutaArchivo} no existe.`);
            return { texto: null, error: "Archivo no encontrado" };
        }

        const dataBuffer = fs.readFileSync(rutaArchivo);
        const data = await pdf(dataBuffer);
        return { texto: data.text };
    } catch (error) {
        console.error("🔴 Error en la extracción de texto del PDF:", error);
        return { texto: null, error: "Error en la extracción" };
    }
};
