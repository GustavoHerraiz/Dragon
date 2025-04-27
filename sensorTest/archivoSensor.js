import { createClient } from 'redis';
import winston from 'winston';

// Configuración del logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'archivoSensor.log' })
    ]
});

// Clientes Redis separados
const publisherClient = createClient(); // Cliente para publicar pulsos
const subscriberClient = createClient(); // Cliente para suscribirse a comandos
const HEARTBEAT_CHANNEL = 'dragon:heartbeat';
const COMMANDS_CHANNEL = 'dragon:commands';

let isPaused = false;

// Función para enviar pulsos compactos
async function sendPulse() {
    if (isPaused) return;

    const pulse = {
        tipo: 'evento_crítico',
        valor: (Math.random() * 100).toFixed(2), // Valor aleatorio simulado
        sensor: 'archivoSensor.js',
        status: 'critical_event',
        timestamp: Date.now()
    };

    try {
        await publisherClient.publish(HEARTBEAT_CHANNEL, JSON.stringify(pulse));
        logger.info({ message: 'Pulso enviado', pulse });
    } catch (error) {
        logger.error({ message: 'Error enviando pulso', error: error.message });
    }
}

// Función para manejar comandos recibidos
async function handleCommand(command) {
    try {
        logger.info({ message: `Comando recibido: ${command}`, sensor: 'archivoSensor.js' });

        if (command === 'PAUSE') {
            isPaused = true;
        } else if (command === 'RESUME') {
            isPaused = false;
        }
    } catch (error) {
        logger.error({ message: 'Error procesando comando', error: error.message });
    }
}

// Función principal
async function main() {
    await Promise.all([publisherClient.connect(), subscriberClient.connect()]);

    logger.info({ message: 'Sensor iniciado: archivoSensor.js' });

    // Suscribirse al canal de comandos
    await subscriberClient.subscribe(COMMANDS_CHANNEL, (command) => handleCommand(command));

    // Enviar pulsos periódicamente
    setInterval(sendPulse, 1000);
}

main().catch((error) => {
    logger.error({ message: 'Error en el sensor', error: error.message });
});
