import { WebSocketServer } from 'ws';
import winston from 'winston';

// Configuración de Winston para registro
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
            return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
        })
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: './logs/servidorCentral.log' })
    ]
});

// DragonEye minimal setup - 37KB monitoring
const DragonEye = {
    sensor: new Map(),
    pulse: (name, metrics) => {
        try {
            DragonEye.sensor.set(name, {
                timestamp: Date.now(),
                metrics,
                status: 'alive'
            });
            logger.info(`💓 DragonEye pulse: ${name} - ${JSON.stringify(metrics)}`);
        } catch (error) {
            logger.error(`💔 DragonEye pulse failed: ${error.message}`);
        }
    }
};

class ServidorCentral {
    constructor(puerto) {
        this.puerto = puerto;
        this.datosRedes = [];
        DragonEye.pulse('servidorCentral', { status: 'initialized', port: puerto });
        this.inicializarServidor();
        this.verificarEstadoServidor();
    }

    inicializarServidor() {
        try {
            const wss = new WebSocketServer({ port: this.puerto });
            logger.info(`🟢 Servidor WebSocket iniciado en el puerto ${this.puerto}.`);
            DragonEye.pulse('websocket', { status: 'started', port: this.puerto });

            wss.on('connection', (ws) => {
                logger.info('🔗 Nueva conexión establecida.');
                DragonEye.pulse('connection', { status: 'new' });

                ws.on('message', (message) => {
                    this.procesarMensaje(ws, message);
                });

                ws.on('close', () => {
                    logger.info('🔌 Conexión cerrada.');
                    DragonEye.pulse('connection', { status: 'closed' });
                });
            });

            wss.on('error', (error) => {
                logger.error(`❌ Error en el servidor WebSocket: ${error.message}`);
                DragonEye.pulse('websocket', { status: 'error', error: error.message });
            });

            this.wss = wss;
        } catch (error) {
            logger.error(`❌ Error al iniciar el servidor WebSocket: ${error.message}`);
            DragonEye.pulse('websocket', { status: 'startup_error', error: error.message });
        }
    }

    verificarEstadoServidor() {
        setInterval(() => {
            logger.info("🟢 El servidor central sigue operativo.");
            DragonEye.pulse('heartbeat', { status: 'alive', connections: this.datosRedes.length });
        }, 6000000);
    }

    procesarMensaje(ws, message) {
        try {
            const mensaje = JSON.parse(message.toString());
            logger.info(`📩 Mensaje recibido de la red: ${JSON.stringify(mensaje)}`);
            DragonEye.pulse('message', { type: mensaje.tipo, network: mensaje.red });

            if (mensaje.tipo === 'confirmacion') {
                if (!mensaje.detalles || !Array.isArray(mensaje.detalles)) {
                    throw new Error('Mensaje de confirmación incompleto: faltan detalles.');
                }

                logger.info(`✅ Confirmación recibida: ${JSON.stringify(mensaje.detalles)}`);
                DragonEye.pulse('confirmation', { details: mensaje.detalles.length });
            } else if (mensaje.tipo === 'resultado' || !mensaje.tipo) {
                if (!mensaje.red || typeof mensaje.salida === "undefined" || !mensaje.detalles || !mensaje.detalles.mensaje) {
                    throw new Error('Mensaje incompleto: falta información necesaria (red, salida, detalles).');
                }

                this.datosRedes.push(mensaje);
                logger.info(`📦 Información almacenada: ${JSON.stringify(mensaje)}`);
                
                const resultadoGlobal = this.procesarPrediccionGlobal();
                logger.info(`📊 Predicción Global calculada: ${resultadoGlobal}`);
                DragonEye.pulse('prediction', { global: resultadoGlobal, networks: this.datosRedes.length });

                const ordenes = this.generarOrdenes(mensaje, resultadoGlobal);
                logger.info(`📜 Órdenes generadas: ${JSON.stringify(ordenes)}`);

                ws.send(JSON.stringify({
                    tipo: 'orden',
                    mensaje: 'Ajustes obligatorios. Debe ejecutarlos de inmediato.',
                    ordenes: ordenes,
                    justificacion: `Basado en los datos recibidos y en la predicción global (${resultadoGlobal}).`
                }));
            } else {
                throw new Error('Tipo de mensaje no reconocido.');
            }
        } catch (error) {
            logger.error(`❌ Error al procesar mensaje: ${error.message}`);
            DragonEye.pulse('error', { type: 'message_processing', error: error.message });
            ws.send(JSON.stringify({
                tipo: 'error',
                mensaje: 'Hubo un error al procesar el mensaje. Por favor verifica el formato.'
            }));
        }
    }

    generarOrdenes(mensaje, resultadoGlobal) {
        const ordenes = [];

        if (mensaje.salida < 5 || resultadoGlobal === 'Baja definición global') {
            ordenes.push({ parametro: "peso_densidad", nuevo_valor: 0.25 });
        } else if (mensaje.salida > 8 || resultadoGlobal === 'Alta definición global') {
            ordenes.push({ parametro: "peso_resolucion", nuevo_valor: 0.18 });
        }

        if (mensaje.detalles && mensaje.detalles.mensaje.includes("Conexión inicial")) {
            ordenes.push({ parametro: "notificacion", mensaje: "Primera revisión completada, ajustes en progreso." });
        }

        DragonEye.pulse('orders', { count: ordenes.length, global: resultadoGlobal });
        return ordenes;
    }

    procesarPrediccionGlobal() {
        try {
            const salidas = this.datosRedes.map(d => typeof d.salida === "number" ? d.salida : 0);
            const promedio = salidas.reduce((acc, val) => acc + val, 0) / salidas.length;
            DragonEye.pulse('global_prediction', { average: promedio, samples: salidas.length });
            return promedio > 5 ? 'Alta definición global' : 'Baja definición global';
        } catch (error) {
            logger.error(`❌ Error al procesar predicción global: ${error.message}`);
            DragonEye.pulse('error', { type: 'global_prediction', error: error.message });
            return 'No disponible';
        }
    }
}

// Inicializar el servidor en el puerto 8080
try {
    const servidor = new ServidorCentral(8080);
    logger.info('🚀 ServidorCentral iniciado correctamente.');
} catch (error) {
    logger.error(`❌ Error crítico al iniciar el servidor central: ${error.message}`);
    DragonEye.pulse('startup', { status: 'error', error: error.message });
}
