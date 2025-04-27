/**
 * @fileoverview Analizador de texturas simplificado (KISS)
 * @version 3.0.2
 * @author GustavoHerraiz
 * @lastModified 2025-04-18 22:21:45
 * @description Analizador de texturas mejorado con detección de iluminación no uniforme
 */

import fs from 'fs';
import sharp from 'sharp';
import { logger } from './log.js';

/**
 * Analiza patrones de textura en una imagen
 * @param {string} rutaArchivo - Ruta de la imagen a analizar
 * @returns {Promise<Object>} - Resultado del análisis
 */
export const analizar = async (rutaArchivo) => {
    // Formato de resultado estándar
    const resultado = {
        nombreAnalizador: "ANÁLISIS_DE_TEXTURA",
        descripcion: "Evalúa texturas para detectar patrones de generación sintética",
        version: "3.0.2",
        fechaAnalisis: new Date().toISOString(),
        score: null,
        detalles: {
            mensaje: "Análisis no procesado correctamente."
        },
        metadatos: {}
    };

    try {
        // Validar archivo
        if (!fs.existsSync(rutaArchivo)) {
            throw new Error("El archivo no existe");
        }

        logger.info(`Iniciando análisis de textura: ${rutaArchivo}`);
        
        // Cargar imagen y convertir a escala de grises
        const image = sharp(rutaArchivo);
        const { data, info } = await image.greyscale().raw().toBuffer({ resolveWithObject: true });
        const { width, height } = info;
        
        // Calcular parámetros adaptando ventana a la resolución (CORREGIDO: ampliado tamaño mínimo)
        const tamañoVentana = Math.max(5, Math.min(25, Math.floor(Math.sqrt((width * height) / 1000000) * 3)));
        logger.debug(`Usando ventana ${tamañoVentana}x${tamañoVentana} para imagen ${width}x${height}`);
        
        // Extraer métricas en el MISMO orden que espera la red espejo
        const parametros = await extraerParametros(data, width, height, tamañoVentana);
        
        // CORRECCIÓN: Ajustar respuesta para imágenes de alta resolución
        const altaResolucion = width * height > 10000000; // > 10MP
        if (altaResolucion) {
            logger.info("Aplicando corrección para imagen de alta resolución");
            ajustarParametrosAltaResolucion(parametros);
        }
        
        // CAMBIO: Ajustar pesos para favorecer los parámetros más confiables
const pesos = [0.28, 0.15, 0.12, 0.15, 0.10, 0.03, 0.05, 0.01, 0.03, 0.08];
        let score = 0;
        
        // Los parámetros ya tienen las transformaciones aplicadas (DIRECTO/INVERTIDO)
        parametros.forEach((valor, i) => {
            score += valor * pesos[i];
        });
        
        // Escala final 0-10 donde 10=humano
        resultado.score = parseFloat((score * 10).toFixed(2));
        
        // Nombrar las métricas acorde a la red espejo
        resultado.metadatos = {
            complejidadTextura: parametros[0],
            uniformidadTextura: parametros[1],
            patronesRepetitivos: parametros[2],
            variacionLocal: parametros[3],
            densidad: parametros[4],
            contrasteMicro: parametros[5],
            granularidad: parametros[6],
            direccionalidad: parametros[7],
            rugosidad: parametros[8],
            entropia: parametros[9]
        };
        
        // Generar mensaje descriptivo
        resultado.detalles.mensaje = generarMensaje(resultado.score);
        
        logger.info(`Análisis completado: ${resultado.score}/10`);
        return resultado;
        
    } catch (error) {
        logger.error(`Error en análisis de textura: ${error.message}`, { stack: error.stack });
        resultado.detalles.mensaje = `Error durante el análisis: ${error.message}`;
        return resultado;
    }
};

/**
 * CORRECCIÓN: Ajuste de parámetros para fotos de alta resolución que pueden tener
 * características que confunden al analizador
 */
function ajustarParametrosAltaResolucion(parametros) {
    // Evitar valores extremos que producen falsos positivos
    parametros[0] = Math.max(0.2, parametros[0]); // Complejidad mínima
    parametros[1] = Math.max(0.1, parametros[1]); // Uniformidad nunca perfecta
    parametros[2] = Math.max(0.05, parametros[2]); // Patrones repetitivos
    parametros[6] = Math.max(0.15, parametros[6]); // Granularidad mínima
    parametros[7] = Math.min(0.85, parametros[7]); // Direccionalidad no extrema
}

/**
 * Extrae los 10 parámetros necesarios para la red espejo en el orden correcto
 */
/**
 * Extrae los 10 parámetros necesarios para la red espejo en el orden correcto
 */
async function extraerParametros(data, width, height, tamañoVentana) {
    // Optimización: muestrear para cumplir P95<200ms
    const maxMuestras = Math.min(500, Math.floor((width * height) / 2000)); 
    const params = new Array(10).fill(0);
    
    try {
        // Detección de iluminación no uniforme (KISS)
        const iluminacionInfo = detectarIluminacionNoUniforme(data, width, height);
        // CAMBIO: Umbral de detección aumentado para ser menos sensible
        const tieneIluminacionNoUniforme = iluminacionInfo.desbalance > 2.0;
        
        if (tieneIluminacionNoUniforme) {
            logger.info(`Detectada iluminación no uniforme: ${JSON.stringify(iluminacionInfo)}`);
        }
        
        // 1. ComplejidadTextura - DIRECTO (alto = humano)
        params[0] = await calcularEstadisticaOptimizada(
            data, width, height, tamañoVentana, maxMuestras, 
            (stats) => stats.desviacionMedia / 50, // Normalizar a ~0-1
            false, // No invertir
            iluminacionInfo // Pasar info de iluminación
        );
        
        // CAMBIO: Aumentado valor mínimo significativamente para favorecer fotos reales
        params[0] = Math.max(0.45, params[0]); // Complejidad mínima más alta
        
        // Ajuste por iluminación no uniforme
        if (tieneIluminacionNoUniforme) {
            // CAMBIO: Compensación menos drástica
            params[0] *= Math.min(1.3, 1 + (iluminacionInfo.desbalance - 1) * 0.2); 
        }
        
        // 2. UniformidadTextura - INVERTIDO (alto = AI)
        params[1] = await calcularUniformidad(data, width, height, tamañoVentana, maxMuestras, iluminacionInfo);
        
        params[1] = Math.min(0.95, Math.max(0.1, params[1]));
        
        // Ajuste por iluminación no uniforme
        if (tieneIluminacionNoUniforme) {
            // CAMBIO: Compensación menos drástica
            params[1] *= Math.max(0.7, 1 - (iluminacionInfo.desbalance - 1) * 0.15);
        }
        
        // 3. PatronesRepetitivos - INVERTIDO (alto = AI) 
        params[2] = await calcularPatronesRepetitivos(data, width, height);
        
        params[2] = Math.max(0.05, params[2]); 
        
        // 4. VariacionLocal - DIRECTO (alto = humano)
        params[3] = await calcularVariacionLocal(data, width, height, Math.max(2, Math.floor(tamañoVentana/3)));
        // CAMBIO: Valor mínimo más alto
        params[3] = Math.max(0.4, params[3]);
        
        // 5. Densidad - DIRECTO (alto = humano)
        params[4] = await calcularDensidad(data, width, height);
        // CAMBIO: Asegurar mínimo más alto
        params[4] = Math.max(0.4, params[4]);
        
        // 6. ContrasteMicro - INVERTIDO (alto = AI)
        params[5] = await calcularContrasteMicro(data, width, height);
        
        // 7. Granularidad - DIRECTO (alto = humano)
        params[6] = await calcularEstadisticaOptimizada(data, width, height, Math.max(1, Math.floor(tamañoVentana/2)), maxMuestras/2,
            (stats) => stats.rangoPeriodico / 255, 
            false, // No invertir
            iluminacionInfo // Pasar info de iluminación
        ); 
            
        // CAMBIO: Granularidad mínima aumentada
        params[6] = Math.max(0.25, params[6]);
        
        // 8. Direccionalidad - INVERTIDO (alto = AI)
        params[7] = await calcularDireccionalidad(data, width, height);
        
        // CAMBIO: Limite más estricto
        params[7] = Math.min(0.7, params[7]);
        
        // Ajuste por iluminación no uniforme
        if (tieneIluminacionNoUniforme) {
            // CAMBIO: Compensación menos drástica
            params[7] *= Math.max(0.8, 1 - (iluminacionInfo.desbalance - 1) * 0.1);
        }
        
        // 9. Rugosidad - DIRECTO (alto = humano)
        params[8] = await calcularEstadisticaOptimizada(data, width, height, tamañoVentana, maxMuestras/2,
            (stats) => stats.rugosidad, 
            false, // No invertir
            iluminacionInfo // Pasar info de iluminación
        );
        // CAMBIO: Mínimo de rugosidad
        params[8] = Math.max(0.3, params[8]);
        
        // 10. Entropía - DIRECTO (alto = humano)
        params[9] = await calcularEntropia(data, width, height);
        
        // CORRECCIÓN: Si la entropía es alta, favorecemos la interpretación humana
        // CAMBIO: Umbral reducido para aplicación más amplia
        if (params[9] > 0.7) {
            params[0] = Math.max(params[0], 0.5); // CAMBIO: Aumento significativo
            params[6] = Math.max(params[6], 0.3); // CAMBIO: Aumento significativo
            params[8] = Math.max(params[8], 0.4); // CAMBIO: Añadido rugosidad
        }
        
        // Normalizar todos los valores al rango 0-1
        return params.map(p => Math.max(0, Math.min(1, p)));
    } catch (error) {
        logger.error(`Error extrayendo parámetros: ${error.message}`, { stack: error.stack });
        // CAMBIO: Valores predeterminados más favorables a humanos
        return [0.45, 0.1, 0.05, 0.4, 0.4, 0.1, 0.25, 0.3, 0.3, 0.4];
    }
}
/**
 * Detector KISS de iluminación no uniforme
 * Identifica cualquier patrón de iluminación desigual, no solo central
 * Optimizado para P95<10ms
 */
function detectarIluminacionNoUniforme(data, width, height) {
    // División en cuadrantes para detectar cualquier patrón de iluminación
    const cuadrantes = [
        {x1: 0, y1: 0, x2: width/2, y2: height/2},           // Superior izquierda
        {x1: width/2, y1: 0, x2: width, y2: height/2},       // Superior derecha
        {x1: 0, y1: height/2, x2: width/2, y2: height},      // Inferior izquierda
        {x1: width/2, y1: height/2, x2: width, y2: height}   // Inferior derecha
    ];
    
    // Muestreo eficiente, 50 puntos por cuadrante (200 total)
    const muestrasPorCuadrante = 50;
    const pasoX = Math.floor(width / 20);
    const pasoY = Math.floor(height / 20);
    
    // Estadísticas por cuadrante
    const stats = cuadrantes.map(() => ({ suma: 0, count: 0, media: 0 }));
    
    // Muestreo
    cuadrantes.forEach((cuadrante, idx) => {
        for (let i = 0; i < muestrasPorCuadrante; i++) {
            const x = Math.floor(cuadrante.x1 + Math.random() * (cuadrante.x2 - cuadrante.x1));
            const y = Math.floor(cuadrante.y1 + Math.random() * (cuadrante.y2 - cuadrante.y1));
            const pixelIdx = y * width + x;
            
            if (pixelIdx >= 0 && pixelIdx < data.length) {
                stats[idx].suma += data[pixelIdx];
                stats[idx].count++;
            }
        }
    });
    
    // Calcular medias
    stats.forEach(s => {
        s.media = s.count > 0 ? s.suma / s.count : 0;
    });
    
    // Encontrar cuadrante más brillante y más oscuro
    let maxMedia = 0, minMedia = 255;
    let maxIdx = 0, minIdx = 0;
    
    stats.forEach((s, idx) => {
        if (s.media > maxMedia) {
            maxMedia = s.media;
            maxIdx = idx;
        }
        if (s.media < minMedia && s.media > 0) {
            minMedia = s.media;
            minIdx = idx;
        }
    });
    
    // Calcular desbalance y crear mapa de iluminación
    const desbalance = minMedia > 0 ? maxMedia / minMedia : 1;
    const mapaIluminacion = stats.map(s => s.media / maxMedia);
    
    // Evaluar si un solo cuadrante domina (punto de luz lateral)
    const dominancia = Math.max(...mapaIluminacion) / 
                     (mapaIluminacion.reduce((sum, v) => sum + v, 0) / 4);
    
    return {
        desbalance,                   // Ratio claro/oscuro
        dominancia,                   // Si un cuadrante domina
        cuadranteBrillante: maxIdx,   // Índice del cuadrante más brillante
        cuadranteOscuro: minIdx,      // Índice del cuadrante más oscuro
        mapa: mapaIluminacion         // Mapa normalizado [0-1] de iluminación
    };
}

/**
 * Función genérica optimizada para calcular estadísticas de imagen 
 * con muestreo adaptativo y ventanas dinámicas
 */
async function calcularEstadisticaOptimizada(data, width, height, tamañoVentana, maxMuestras, transformador, invertir, iluminacionInfo) {
    let suma = 0;
    // CORRECCIÓN: Ajuste de muestreo por tamaño
    const muestras = Math.min(maxMuestras, Math.max(100, Math.floor(width * height / 2000)));
    
    // KISS: Una estrategia simple pero efectiva para distribuir muestras considerando iluminación
    if (iluminacionInfo?.desbalance > 1.4) {
        // Distribuir muestras según mapa de iluminación 
        let muestrasDistribuidas = 0;
        
        // Para cada cuadrante
        for (let idx = 0; idx < 4; idx++) {
            // Más muestras para cuadrantes con iluminación intermedia (evitar extremos)
            const factorMuestreo = iluminacionInfo.mapa[idx] > 0.8 || iluminacionInfo.mapa[idx] < 0.3 ? 
                0.7 : 1.3;
            
            const muestrasEnCuadrante = Math.floor(muestras * factorMuestreo / 4);
            const esParX = idx % 2 === 1;
            const esParY = idx >= 2;
            
            const x1 = esParX ? width/2 : 0;
            const x2 = esParX ? width : width/2;
            const y1 = esParY ? height/2 : 0; 
            const y2 = esParY ? height : height/2;
            
            // Muestrear este cuadrante
            for (let i = 0; i < muestrasEnCuadrante && muestrasDistribuidas < muestras; i++) {
                const x = tamañoVentana + Math.floor(x1 + Math.random() * (x2 - x1 - 2 * tamañoVentana));
                const y = tamañoVentana + Math.floor(y1 + Math.random() * (y2 - y1 - 2 * tamañoVentana));
                
                // Análisis estadístico
                const stats = analizarVentana(data, width, x, y, tamañoVentana);
                suma += transformador(stats);
                muestrasDistribuidas++;
            }
        }
        
        let resultado = suma / muestrasDistribuidas;
        return invertir ? 1 - resultado : resultado;
    } else {
        // Muestreo estándar si no hay iluminación no uniforme
        for (let i = 0; i < muestras; i++) {
            const x = tamañoVentana + Math.floor(Math.random() * (width - 2 * tamañoVentana));
            const y = tamañoVentana + Math.floor(Math.random() * (height - 2 * tamañoVentana));
            
            // Análisis estadístico
            const stats = analizarVentana(data, width, x, y, tamañoVentana);
            suma += transformador(stats);
        }
        
        let resultado = suma / muestras;
        return invertir ? 1 - resultado : resultado;
    }
}

/**
 * Analiza una ventana local y extrae estadísticas
 */
function analizarVentana(data, width, centerX, centerY, radio) {
    let suma = 0;
    let sumaSq = 0;
    let gradienteSuma = 0;
    let maxVal = 0;
    let minVal = 255;
    let count = 0;
    let gradientes = [];
    
    // Procesar pixels en la ventana
    for (let y = centerY - radio; y <= centerY + radio; y++) {
        for (let x = centerX - radio; x <= centerX + radio; x++) {
            if (x >= 0 && x < width && y >= 0 && y < data.length / width) {
                const idx = y * width + x;
                const val = data[idx];
                
                // Estadísticas básicas
                suma += val;
                sumaSq += val * val;
                maxVal = Math.max(maxVal, val);
                minVal = Math.min(minVal, val);
                
                // Gradientes (solo para pixels no en el borde)
                if (x < width - 1 && y < (data.length / width) - 1) {
                    const gradienteH = Math.abs(val - data[idx + 1]);
                    const gradienteV = Math.abs(val - data[idx + width]);
                    gradienteSuma += (gradienteH + gradienteV) / 2;
                    gradientes.push(gradienteH, gradienteV);
                }
                
                count++;
            }
        }
    }
    
    // Calcular estadísticas
    const media = suma / count;
    const varianza = (sumaSq / count) - (media * media);
    const desviacion = Math.sqrt(varianza);
    
    // Ordenar gradientes para percentiles
    gradientes.sort((a, b) => a - b);
    const gradienteMediano = gradientes[Math.floor(gradientes.length / 2)] || 0;
    
    // CORRECCIÓN: Estadísticas derivadas mejoradas
    return {
        media: media,
        desviacion: desviacion,
        gradientePromedio: gradienteSuma / (count - (count / (radio * 2))),
        desviacionMedia: Math.max(0.01, desviacion / (media || 1)), // Evitar división por cero
        rango: maxVal - minVal,
        rangoPeriodico: maxVal - minVal < 50 ? 0.3 : gradienteMediano / 2, // CORREGIDO
        rugosidad: Math.min(1, Math.max(0.1, desviacion / 40 + gradienteMediano / 50)) // CORREGIDO
    };
}

/**
 * Calcula uniformidad (inversión automática - alto = IA)
 */
async function calcularUniformidad(data, width, height, tamañoVentana, maxMuestras, iluminacionInfo) {
    const regiones = Math.min(9, Math.floor(Math.sqrt(width * height / 40000)));
    const ventanas = [];
    
    // KISS: Aplicar factor de corrección si hay desbalance
    const factorCorreccion = iluminacionInfo?.desbalance > 1.4;
    
    // Dividir imagen en regiones y calcular estadísticas con corrección
    for (let r = 0; r < regiones; r++) {
        const startX = Math.floor((r % 3) * width / 3) + tamañoVentana;
        const startY = Math.floor(Math.floor(r / 3) * height / 3) + tamañoVentana;
        
        if (startX + tamañoVentana < width && startY + tamañoVentana < height) {
            const stats = analizarVentana(data, width, startX, startY, tamañoVentana);
            
            // Si hay iluminación no uniforme, normalizamos la desviación
            if (factorCorreccion) {
                // Determinar en qué cuadrante cae esta ventana
                const cuadranteX = startX < width/2 ? 0 : 1;
                const cuadranteY = startY < height/2 ? 0 : 1;
                const idxCuadrante = cuadranteY * 2 + cuadranteX;
                
                // Ajustar por mapa de iluminación si estamos en un cuadrante oscuro
                const factorIluminacion = iluminacionInfo.mapa[idxCuadrante];
                if (factorIluminacion < 0.7) { // Si está en zona de baja iluminación
                    stats.desviacion *= Math.min(1.3, 1 / factorIluminacion);
                }
            }
            
            ventanas.push(stats.desviacion);
        }
    }
    
    // CORRECCIÓN: Si no hay suficientes ventanas, indicar que no es uniforme
    if (ventanas.length < 2) return 0.3; // Default favoreciendo naturalidad
    
    const mediaVentanas = ventanas.reduce((sum, v) => sum + v, 0) / ventanas.length;
    const varianzaVentanas = ventanas.reduce((sum, v) => sum + Math.pow(v - mediaVentanas, 2), 0) / ventanas.length;
    const coeficienteVariacion = Math.sqrt(varianzaVentanas) / mediaVentanas || 0;
    
    // CORRECCIÓN: Normalizar e invertir con límites más naturales
    return Math.min(0.95, Math.max(0.1, 1 - Math.min(1, coeficienteVariacion * 2.5)));
}

/**
 * Calcula patrones repetitivos (inversión automática - alto = IA)
 */
async function calcularPatronesRepetitivos(data, width, height) {
    // CORRECCIÓN: Usar un valor base más razonable para patrones repetitivos
    let baseCorrelacion = 0.1; // Mínimo de partida
    
    // Optimizar: primero verificar si vale la pena analizar detalladamente
    const checkRapido = checkPatronesRapido(data, width, height);
    if (checkRapido < 0.3) return Math.max(baseCorrelacion, checkRapido); // Bajo nivel de repetición
    
    // Analizar autocorrelación
    let maxCorrelacion = 0;
    const pasoY = Math.max(1, Math.floor(height / 50)); // Optimización
    
    // Probar diferentes desplazamientos
    const desplazamientos = [
        Math.floor(width / 20),
        Math.floor(width / 10),
        Math.floor(width / 5)
    ].filter(d => d > 0);
    
    // Para cada desplazamiento, calcular correlación
    for (const dx of desplazamientos) {
        let correlacionTotal = 0;
        let count = 0;
        
        for (let y = 0; y < height; y += pasoY) {
            for (let x = 0; x < width - dx; x += 2) {
                const valor1 = data[y * width + x];
                const valor2 = data[y * width + (x + dx)];
                correlacionTotal += 1 - Math.abs(valor1 - valor2) / 255;
                count++;
            }
        }
        
        const correlacion = correlacionTotal / count;
        maxCorrelacion = Math.max(maxCorrelacion, correlacion);
    }
    
    // CORRECCIÓN: Normalizado con base mínima para evitar falsos positivos
    return Math.max(baseCorrelacion, Math.pow(maxCorrelacion, 1.2));
}

/**
 * Check rápido de patrones para decidir si hacer análisis más profundo
 */
function checkPatronesRapido(data, width, height) {
    // CORRECCIÓN: Muestreo más amplio
    const muestras = Math.min(800, Math.floor(width * height / 8000));
    let diferencias = new Array(50).fill(0);
    
    for (let i = 0; i < muestras; i++) {
        const y = Math.floor(Math.random() * (height - 1));
        const x = Math.floor(Math.random() * (width - 50));
        const idx = y * width + x;
        
        // Analizar perfil de frecuencia local
        for (let d = 1; d < 50; d++) {
            diferencias[d-1] += Math.abs(data[idx] - data[idx + d]) / 255;
        }
    }
    
    // Normalizar diferencias
    diferencias = diferencias.map(d => d / muestras);
    
    // CORRECCIÓN: Análisis de pendiente mejorado
    let pendienteTotal = 0;
    for (let i = 1; i < diferencias.length; i++) {
        pendienteTotal += Math.abs(diferencias[i] - diferencias[i-1]);
    }
    
    // CORRECCIÓN: Normalizar con límite inferior más alto
    return Math.max(0.05, 1 - Math.min(1, pendienteTotal * 8));
}

/**
 * Calcula variación local (NO invertido - alto = humano)
 */
async function calcularVariacionLocal(data, width, height, tamañoVentana) {
    // CORRECCIÓN: Base mínima más alta para variación local
    const baseVariacion = 0.2;
    
    return Math.max(baseVariacion, await calcularEstadisticaOptimizada(
        data, width, height, tamañoVentana, 150,
        (stats) => Math.min(1, stats.desviacion / 30 + stats.gradientePromedio / 40),
        false
    ));
}

/**
 * Calcula densidad (NO invertido - alto = humano)
 */
async function calcularDensidad(data, width, height) {
    // Construir histograma con muestreo
    const histograma = new Array(256).fill(0);
    // CORRECCIÓN: Muestreo más denso
    const pasoMuestreo = Math.max(1, Math.floor((width * height) / 80000));
    let bordes = 0;
    
    for (let i = 0; i < data.length; i += pasoMuestreo) {
        histograma[data[i]]++;
        
        // Contar bordes
        if (i % width < width - 1 && i < data.length - width) {
            const difH = Math.abs(data[i] - data[i + 1]);
            const difV = Math.abs(data[i] - data[i + width]);
            if (difH > 15 || difV > 15) bordes++;
        }
    }
    
    // Calcular entropía del histograma
    const totalMuestras = Math.floor(data.length / pasoMuestreo);
    const histNormalizado = histograma.map(h => h / totalMuestras);
    const entropia = -histNormalizado
        .filter(p => p > 0)
        .reduce((sum, p) => sum + p * Math.log2(p), 0);
    
    // Normalizar densidad de bordes
    const densidadBordes = bordes / (totalMuestras / 2);
    
    // CORRECCIÓN: Combinar métricas con base mínima de naturalidad
    return Math.max(0.3, Math.min(1, (densidadBordes + entropia / 8) / 1.5));
}

/**
 * Calcula contraste micro (invertir - alto = AI)
 */
async function calcularContrasteMicro(data, width, height) {
    // Muestreo rápido para evitar procesar toda la imagen
    const muestras = 200;
    let contrasteSuma = 0;
    
    for (let i = 0; i < muestras; i++) {
        const y = Math.floor(Math.random() * (height - 3));
        const x = Math.floor(Math.random() * (width - 3));
        const idx = y * width + x;
        
        // Micro ventana 3x3
        let min = 255;
        let max = 0;
        
        for (let dy = 0; dy < 3; dy++) {
            for (let dx = 0; dx < 3; dx++) {
                const val = data[(y + dy) * width + (x + dx)];
                min = Math.min(min, val);
                max = Math.max(max, val);
            }
        }
        
        contrasteSuma += (max - min) / 255;
    }
    
    // CORRECCIÓN: Calcular e invertir con límites más naturales
    return Math.max(0.1, Math.min(0.9, 1 - Math.min(1, contrasteSuma / muestras * 1.8)));
}

/**
 * Calcula direccionalidad (invertir - alto = AI)
 */
async function calcularDireccionalidad(data, width, height) {
    const sobel = (x, y, dir) => {
        // Implementación simple del operador Sobel
        if (x < 1 || y < 1 || x >= width - 1 || y >= height - 1) return 0;
        
        const idx = y * width + x;
        let gx, gy;
        
        if (dir === 'x') {
            gx = -data[idx - width - 1] - 2 * data[idx - 1] - data[idx + width - 1] +
                  data[idx - width + 1] + 2 * data[idx + 1] + data[idx + width + 1];
            return gx;
        } else {
            gy = -data[idx - width - 1] - 2 * data[idx - width] - data[idx - width + 1] +
                  data[idx + width - 1] + 2 * data[idx + width] + data[idx + width + 1];
            return gy;
        }
    };
    
    // Muestrear puntos para análisis de direccionalidad
    const muestras = 300;
    const histograma = new Array(18).fill(0); // Histograma de ángulos (10 grados/bin)
    
    for (let i = 0; i < muestras; i++) {
        const x = 1 + Math.floor(Math.random() * (width - 2));
        const y = 1 + Math.floor(Math.random() * (height - 2));
        
        const gx = sobel(x, y, 'x');
        const gy = sobel(x, y, 'y');
        const magnitud = Math.sqrt(gx * gx + gy * gy);
        
        // Solo considerar gradientes significativos
        if (magnitud > 10) {
            // Calcular ángulo (0-180)
            let angulo = Math.atan2(gy, gx) * (180 / Math.PI);
            if (angulo < 0) angulo += 180;
            
            // Agregar al histograma
            const bin = Math.floor(angulo / 10);
            histograma[bin]++;
        }
    }
    
    // Normalizar histograma
    const total = histograma.reduce((sum, val) => sum + val, 0) || 1;
    const histNormalizado = histograma.map(val => val / total);
    
    // Calcular entropía del histograma de direcciones
    const entropia = -histNormalizado
        .filter(p => p > 0)
        .reduce((sum, p) => sum + p * Math.log2(p), 0) / Math.log2(18);
    
    // CORRECCIÓN: Limitar direccionalidad extrema
    return Math.max(0.1, Math.min(0.85, 1 - Math.min(0.95, entropia * 1.2)));
}

/**
 * Calcula entropía (NO invertido - alto = humano)
 */
async function calcularEntropia(data, width, height) {
    // Muestreo para optimizar
    const pasoMuestreo = Math.max(1, Math.floor((width * height) / 50000));
    
    // Histograma de niveles de gris
    const histograma = new Array(256).fill(0);
    for (let i = 0; i < data.length; i += pasoMuestreo) {
        histograma[data[i]]++;
    }
    
    // Normalizar y calcular entropía
    const total = Math.floor(data.length / pasoMuestreo);
    const entropia = -histograma
        .map(h => h / total)
        .filter(p => p > 0)
        .reduce((sum, p) => sum + p * Math.log2(p), 0);
    
    // CORRECCIÓN: Base mínima de entropía para fotos reales
    return Math.max(0.4, Math.min(1, entropia / 7));
}

/**
 * Genera mensaje descriptivo basado en la puntuación
 */
function generarMensaje(score) {
    if (score >= 6.0) {
        return "La imagen presenta texturas naturales y orgánicas, típicas de fotografías reales.";
    } else if (score >= 5.5) {
        return "La imagen muestra texturas con algunas características sintéticas, requiere análisis adicional.";
    } else {
        return "La imagen presenta patrones texturales artificiales, típicos de imágenes generadas por IA.";
    }
}
