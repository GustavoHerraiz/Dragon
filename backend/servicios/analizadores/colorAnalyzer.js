import fs from 'fs';
import sharp from 'sharp'; // Utilizado para el análisis de imágenes
import { logger } from './log.js';
import exifr from 'exifr'; // Para extraer metadatos EXIF

export const analizar = async (rutaArchivo) => {
    const resultado = {
        nombreAnalizador: "ANÁLISIS_DE_COLOR",
        descripcion: "Analiza la composición de colores en la imagen, incluyendo su balance y gama cromática, para determinar características que indiquen manipulación o generación sintética.",
        score: null,
        detalles: {
            coloresDominantes: "No disponible",
            balanceColor: "No disponible",
            mensaje: "Análisis no procesado correctamente."
        },
        metadatos: {}, // Metadatos relevantes se almacenarán aquí
        logs: []
    };

    try {
        // Validar la existencia del archivo
        if (!fs.existsSync(rutaArchivo)) throw new Error("El archivo no existe.");
        logger.info("Archivo validado.");
        resultado.logs.push("Archivo validado.");

        // Leer la imagen y analizarla usando sharp
        const image = sharp(rutaArchivo);

        // Extraer estadísticas de colores
        const stats = await image.stats();
        if (!stats || !stats.dominant) throw new Error("No se pudieron extraer los colores dominantes.");
        const dominant = stats.dominant;

        // Extraer colores dominantes
        resultado.detalles.coloresDominantes = `RGB(${Math.round(dominant.r)}, ${Math.round(dominant.g)}, ${Math.round(dominant.b)})`;

        // Calcular el "balance de color"
        const balanceColor = (dominant.r + dominant.g + dominant.b) / 3;
        resultado.detalles.balanceColor = balanceColor > 150 ? "Colores brillantes" : "Colores apagados";

        resultado.logs.push("Análisis de colores completado.");

        // Validar Espacio de Color
        const metadatosCompletos = await exifr.parse(rutaArchivo) || {};
        resultado.logs.push("Metadatos extraídos correctamente.");
        let espacioColor = metadatosCompletos.ColorSpace || "No definido";

        // Manejo específico para espacios de color (incluyendo rango)
        let espacioDeColorValido = false;
        if (espacioColor === 1 || espacioColor === "sRGB" || espacioColor === "AdobeRGB") {
            espacioDeColorValido = true; // Espacio válido
        } else if (typeof espacioColor === "number" && espacioColor >= 65000 && espacioColor <= 66000) {
            espacioColor = "No definido (posiblemente válido dentro de rango profesional)";
            espacioDeColorValido = true; // No penalizamos si coincide con rango profesional
        } else {
            espacioDeColorValido = false; // Espacio desconocido fuera del rango
        }

        // Validar el Balance de Blancos
        const balanceDeBlancos = metadatosCompletos.WhiteBalance || "No disponible";
        let ajustePorBalance = 0; // Incremento en puntuación por balance manual
        if (balanceDeBlancos === "Manual") {
            ajustePorBalance = 1; // Añade un punto si el balance es manual
            resultado.logs.push("Se detectó balance de blancos manual, indicando intervención humana.");
        }

        // Ajustar puntuación basada en balance cromático, espacio de color y balance de blancos
        if (balanceColor > 200 && espacioDeColorValido) {
            resultado.score = 9 + ajustePorBalance; // Colores vibrantes con espacio válido y ajuste humano
        } else if (balanceColor > 120 && espacioDeColorValido) {
            resultado.score = 8 + ajustePorBalance; // Colores equilibrados con espacio válido
        } else if (balanceColor > 80 || espacioDeColorValido) {
            resultado.score = 7 + ajustePorBalance; // Colores aceptables con espacio no estándar pero permitido
        } else {
            resultado.score = 5 + ajustePorBalance; // Penalización menor si hay balance manual
        }

        // Actualizar mensaje
        resultado.detalles.mensaje = resultado.score >= 8
            ? "La imagen presenta una composición cromática rica y equilibrada, con un espacio de color válido y ajustes realizados manualmente."
            : resultado.score >= 7
                ? "La imagen tiene colores aceptables, con indicios de ajustes manuales que aportan consistencia."
                : "La imagen presenta irregularidades en los colores o un espacio de color no estándar, lo que podría sugerir manipulación o generación sintética.";

        // Seleccionar metadatos relevantes
        const metadatosRelevantes = {
            EspacioDeColor: espacioColor,
            BalanceDeBlancos: balanceDeBlancos,
            Saturación: metadatosCompletos.Saturation || "No disponible",
            Contraste: metadatosCompletos.Contrast || "No disponible",
            Software: metadatosCompletos.Software || "No disponible"
        };

        // Asignar los metadatos relevantes
        resultado.metadatos = { ...metadatosRelevantes };

        // Log para los metadatos relevantes
        logger.info(
            `Metadatos procesados: EspacioDeColor: ${metadatosRelevantes.EspacioDeColor}, BalanceDeBlancos: ${metadatosRelevantes.BalanceDeBlancos}, Saturación: ${metadatosRelevantes.Saturación}, Contraste: ${metadatosRelevantes.Contraste}`
        );
        resultado.logs.push("Metadatos procesados correctamente.");

    } catch (error) {
        resultado.score = null;
        resultado.detalles.mensaje = `Error durante el análisis: ${error.message}`;
        resultado.logs.push(`Error: ${error.message}`);
        logger.error(`Error durante el análisis: ${error.message}`);
    }

    return resultado;
};
