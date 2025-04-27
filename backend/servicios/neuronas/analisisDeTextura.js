/**
 * @fileoverview Red neuronal para análisis de texturas en imágenes
 * @version 1.0.0
 * @author Gustavo Herraiz
 * @description Analiza patrones de textura para distinguir entre imágenes naturales y sintéticas
 * @requires synaptic
 * @requires winston
 * @requires fs
 * @requires WebSocket
 */

import synaptic from "synaptic";
import winston from "winston";
import fs from "fs";
import WebSocket from "ws";

// Configuración del logger específico para la red de textura
const logger = winston.createLogger({
    level: "info",
    transports: [
        new winston.transports.Console({ format: winston.format.simple() }),
        new winston.transports.File({ filename: "./logs/redAnalisisTextura.log" }),
    ],
});

/**
 * @description Parámetros de entrada para el análisis de textura
 * Los pesos están calibrados y las transformaciones ajustadas (1 = humano, 0 = AI)
 */
const parametros = [
    { 
        nombre: "ComplejidadTextura", 
        peso: 0.20,
        valor: (v) => v,  // DIRECTO: alto = humano
        descripcion: "Nivel de complejidad en los patrones texturales"
    },
    { 
        nombre: "UniformidadTextura", 
        peso: 0.20,
        valor: (v) => 1 - v,  // INVERTIR: alto = AI
        descripcion: "Grado de uniformidad en la distribución de texturas"
    },
    { 
        nombre: "PatronesRepetitivos", 
        peso: 0.15,
        valor: (v) => 1 - v,  // INVERTIR: alto = AI
        descripcion: "Presencia de patrones que se repiten"
    },
    { 
        nombre: "VariacionLocal", 
        peso: 0.10,
        valor: (v) => v,  // DIRECTO: alto = humano
        descripcion: "Variaciones en pequeñas áreas de la imagen"
    },
    { 
        nombre: "Densidad", 
        peso: 0.10,
        valor: (v) => v,  // DIRECTO: alto = humano
        descripcion: "Densidad de elementos texturales"
    },
    { 
        nombre: "ContrasteMicro", 
        peso: 0.05,
        valor: (v) => 1 - v,  // INVERTIR: alto = AI
        descripcion: "Contraste a nivel micro de la textura"
    },
    { 
        nombre: "Granularidad", 
        peso: 0.05,
        valor: (v) => v,  // DIRECTO: alto = humano
        descripcion: "Tamaño y distribución de los granos texturales"
    },
    { 
        nombre: "Direccionalidad", 
        peso: 0.05,
        valor: (v) => 1 - v,  // INVERTIR: alto = AI
        descripcion: "Presencia de patrones direccionales"
    },
    { 
        nombre: "Rugosidad", 
        peso: 0.05,
        valor: (v) => v,  // DIRECTO: alto = humano
        descripcion: "Nivel de rugosidad de la textura"
    },
    { 
        nombre: "Entropía", 
        peso: 0.05,
        valor: (v) => v,  // DIRECTO: alto = humano
        descripcion: "Aleatoriedad en la distribución textural"
    }
];

/**
 * @class RedAnalisisTextura
 * @description Clase principal para el análisis de texturas mediante red neuronal
 */
class RedAnalisisTextura {
    /**
     * @constructor
     * @description Inicializa la red neuronal y establece la conexión con el servidor central
     */
    constructor() {
    try {
        // Intentar cargar el modelo entrenado
        const modelPath = "/var/www/ProyectoDragon/backend/servicios/neuronas/RedDeTextura_Entrenada.json";
        logger.info(`📂 Intentando cargar modelo desde: ${modelPath}`);
        
        const rawData = fs.readFileSync(modelPath, "utf8");
        logger.info("✅ Archivo leído correctamente");
        
        const modelData = JSON.parse(rawData);
        logger.info("✅ JSON parseado correctamente");

        // Crear la red usando los datos del JSON
        const { Layer, Network } = synaptic;
        
        // Crear las capas
        const inputLayer = new Layer(modelData.layers.input.size);
        const hiddenLayer = new Layer(modelData.layers.hidden[0].size);
        const outputLayer = new Layer(modelData.layers.output.size);
        
        // Conectar las capas
        inputLayer.project(hiddenLayer);
        hiddenLayer.project(outputLayer);
        
        this.network = new Network({
            input: inputLayer,
            hidden: [hiddenLayer],
            output: outputLayer
        });

        // Establecer los pesos
        const inputConnections = inputLayer.connections;
        const hiddenConnections = hiddenLayer.connections;

        // Establecer pesos input->hidden
        for (let i = 0; i < inputConnections.length; i++) {
            const inputNeuronIndex = Math.floor(i / modelData.layers.hidden[0].size);
            const hiddenNeuronIndex = i % modelData.layers.hidden[0].size;
            inputConnections[i].weight = modelData.weights.input_hidden[inputNeuronIndex][hiddenNeuronIndex];
        }

        // Establecer pesos hidden->output
        for (let i = 0; i < hiddenConnections.length; i++) {
            hiddenConnections[i].weight = modelData.weights.hidden_output[i][0];
        }

        logger.info("✅ Modelo de análisis de textura cargado y configurado correctamente");
        
    } catch (error) {
        // Inicializar red por defecto si hay error
        logger.error(`❌ Error al cargar el modelo: ${error.message}`);
        logger.info("⚠️ Inicializando red por defecto...");
        
        const { Layer, Network } = synaptic;
        const inputLayer = new Layer(10);
        const hiddenLayer = new Layer(5);
        const outputLayer = new Layer(1);
        
        inputLayer.project(hiddenLayer);
        hiddenLayer.project(outputLayer);
        
        this.network = new Network({
            input: inputLayer,
            hidden: [hiddenLayer],
            output: outputLayer
        });
        
        logger.info("⚠️ Red neuronal inicializada por defecto");
    }

    logger.info("🌐 Iniciando conexión con el servidor central...");
    this.conectarConServidor();
}

    /**
     * @method conectarConServidor
     * @description Establece y mantiene la conexión WebSocket con el servidor central
     */
    conectarConServidor() {
        const socket = new WebSocket("ws://localhost:8080");

        socket.on("open", () => {
            logger.info("🔗 Conexión establecida con el servidor central");
            socket.send(JSON.stringify({
                red: "analisisDeTextura",
                salida: 1,
                detalles: { mensaje: "Conexión inicial exitosa" }
            }));
        });

        socket.on("error", (error) => {
            logger.error(`❌ Error en la conexión WebSocket: ${error.message}`);
        });

        socket.on("message", (message) => {
            try {
                const respuesta = JSON.parse(message);
                logger.info(`📨 Mensaje recibido: ${JSON.stringify(respuesta)}`);

                if (respuesta.tipo === "orden" && respuesta.ordenes) {
                    this.procesarOrdenes(respuesta.ordenes, socket);
                }
            } catch (error) {
                logger.error(`❌ Error procesando mensaje: ${error.message}`);
            }
        });

        socket.on("close", () => {
            logger.warn("🔌 Conexión cerrada. Reintentando en 5 segundos...");
            setTimeout(() => this.conectarConServidor(), 5000);
        });

        this.socket = socket;
    }

    /**
     * @method procesarOrdenes
     * @param {Array} ordenes - Órdenes recibidas del servidor
     * @param {WebSocket} socket - Conexión WebSocket activa
     * @description Procesa las órdenes recibidas del servidor central
     */
    procesarOrdenes(ordenes, socket) {
        logger.info("🔧 Procesando órdenes del servidor central...");
        ordenes.forEach(orden => {
            const parametro = parametros.find(p => p.nombre === orden.parametro);
            if (parametro && orden.nuevo_valor) {
                parametro.peso = orden.nuevo_valor;
                logger.info(`✅ Actualizado peso de ${orden.parametro}: ${orden.nuevo_valor}`);
            }
        });

        socket.send(JSON.stringify({
            tipo: "confirmacion",
            mensaje: "Órdenes ejecutadas correctamente",
            detalles: ordenes
        }));
    }

    /**
     * @method analizar
     * @param {Array} datos - Array de valores normalizados (0-1) para cada parámetro
     * @returns {Object} Resultado del análisis
     * @description Analiza los datos de textura y genera una evaluación
     */
    async analizar(datos) {
        try {
            logger.info("📥 Iniciando análisis de textura:");
            logger.info(JSON.stringify(datos, null, 2));

            // Validar y normalizar datos, aplicando las transformaciones
            const datosTransformados = datos.map((dato, index) => {
                const valor = typeof dato === 'number' ? dato : 0;
                const valorTransformado = parametros[index].valor(valor);
                logger.info(`${parametros[index].nombre}: ${valor} → ${valorTransformado}`);
                return valorTransformado;
            });

            // Procesar con la red neuronal usando datos transformados
            const resultadoRed = this.network.activate(datosTransformados);
            
            // Calcular score ponderado con valores transformados
            let scorePonderado = 0;
            datosTransformados.forEach((valor, i) => {
                scorePonderado += valor * parametros[i].peso;
                logger.info(`🔍 ${parametros[i].nombre}: ${valor} (Peso: ${parametros[i].peso})`);
            });

            const scoreFinal = parseFloat((scorePonderado * 10).toFixed(2));

            const resultadoFormateado = {
                nombreAnalizador: "ANÁLISIS_DE_TEXTURA",
                descripcion: "Evalúa patrones y características de textura para identificar imágenes sintéticas",
                score: scoreFinal,
                metadatos: {
                    complejidadTextura: datosTransformados[0],
                    uniformidadTextura: datosTransformados[1],
                    patronesRepetitivos: datosTransformados[2],
                    variacionesLocales: datosTransformados[3],
                    densidadTextural: datosTransformados[4],
                    contrasteMicro: datosTransformados[5],
                    granularidad: datosTransformados[6],
                    direccionalidad: datosTransformados[7],
                    rugosidad: datosTransformados[8],
                    entropía: datosTransformados[9]
                },
                detalles: {
                    complejidadTextura: scoreFinal > 7 ? "Natural" : "Sintética",
                    uniformidadTextura: scoreFinal < 6 ? "Natural" : "Sintética",
                    patronesIdentificados: scoreFinal < 5 ? "Patrones artificiales" : "Patrones naturales",
                    mensaje: this.generarMensaje(scoreFinal)
                }
            };

            // Enviar resultado al servidor central
            if (this.socket?.readyState === WebSocket.OPEN) {
                this.socket.send(JSON.stringify({
                    red: "analisisDeTextura",
                    salida: resultadoFormateado.score,
                    detalles: resultadoFormateado.detalles
                }));
                logger.info("📤 Resultado enviado al servidor central");
            }

            return resultadoFormateado;

        } catch (error) {
            logger.error(`❌ Error en análisis: ${error.message}`);
            return {
                error: "Error en análisis de textura",
                detalles: { mensaje: error.message }
            };
        }
    }

    /**
     * @method generarMensaje
     * @param {number} score - Puntuación final del análisis
     * @returns {string} Mensaje descriptivo del resultado
     * @description Genera un mensaje descriptivo basado en la puntuación
     */
    generarMensaje(score) {
        if (score >= 8) {
            return "La imagen presenta texturas naturales y orgánicas, típicas de fotografías reales.";
        } else if (score >= 6) {
            return "La imagen muestra texturas con algunas características sintéticas, requiere análisis adicional.";
        } else {
            return "La imagen presenta patrones texturales artificiales, típicos de imágenes generadas por IA.";
        }
    }
}

export default RedAnalisisTextura;
