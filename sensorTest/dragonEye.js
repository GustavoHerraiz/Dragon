import { createClient } from 'redis';
import winston from 'winston';

// Configuración del logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.File({ filename: 'dragonEye.log' }),
        new winston.transports.Console()
    ]
});

// Configuración de Redis
const subscriber = createClient();
const HEARTBEAT_CHANNEL = 'dragon:heartbeat';

async function main() {
    await subscriber.connect();

    logger.info({ message: 'Conectado a Redis', component: 'dragonEye' });

    // Suscribirse al canal de pulsos
    subscriber.subscribe(HEARTBEAT_CHANNEL, (message) => {
        const pulse = JSON.parse(message);

        // Calcular el tiempo de procesamiento
        const currentTime = Date.now();
        const processingTime = currentTime - pulse.timestamp;

        // Calcular el peso del pulso en bytes
        const pulseSize = Buffer.byteLength(message, 'utf8');

        // Loggear el pulso recibido con tiempos y tamaño
        if (pulse.status === 'critical_event') {
            logger.warn({
                message: 'Evento crítico recibido',
                processingTime: `${processingTime}ms`,
                pulseSize: `${pulseSize} bytes`,
                ...pulse
            });
        } else {
            logger.info({
                message: 'Pulso recibido',
                processingTime: `${processingTime}ms`,
                pulseSize: `${pulseSize} bytes`,
                ...pulse
            });
        }
    });
}

main().catch((error) => logger.error({ message: 'Error en dragonEye', error: error.message }));
