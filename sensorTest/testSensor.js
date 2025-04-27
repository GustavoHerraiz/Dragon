import { createClient } from 'redis';
import winston from 'winston';

// Configuración del logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'testSensor.log' })
    ]
});

// Configuración de Redis
const publisherClient = createClient(); // Cliente para publicar comandos
const subscriberClient = createClient(); // Cliente para suscribirse a pulsos
const HEARTBEAT_CHANNEL = 'dragon:heartbeat';
const COMMANDS_CHANNEL = 'dragon:commands';

// Función para enviar comandos a los sensores
async function sendCommand(command) {
    try {
        logger.info({ message: `Enviando comando: ${command}` });
        await publisherClient.publish(COMMANDS_CHANNEL, command);
        logger.info({ message: `Comando enviado: ${command}` });
    } catch (error) {
        logger.error({ message: `Error enviando comando: ${command}`, error: error.message });
    }
}

// Función para monitorear pulsos desde los sensores
async function monitorPulses() {
    try {
        await subscriberClient.subscribe(HEARTBEAT_CHANNEL, (message) => {
            const pulse = JSON.parse(message);
            logger.info({ message: 'Pulso recibido', pulse });
        });
    } catch (error) {
        logger.error({ message: 'Error monitoreando pulsos', error: error.message });
    }
}

// Script principal
async function main() {
    try {
        await Promise.all([publisherClient.connect(), subscriberClient.connect()]);

        logger.info({ message: 'Conectado a Redis. Iniciando test de sensores bidireccionales.' });

        // Monitorear pulsos en segundo plano
        monitorPulses();

        // Enviar comandos de prueba con pausas
        setTimeout(() => sendCommand('PAUSE'), 3000); // Pausar sensores después de 3s
        setTimeout(() => sendCommand('RESUME'), 6000); // Reanudar sensores después de 6s
        setTimeout(() => sendCommand('PAUSE'), 9000); // Pausar sensores nuevamente después de 9s
        setTimeout(() => sendCommand('RESUME'), 12000); // Reanudar sensores nuevamente después de 12s

        // Finalizar conexión después de 15s
        setTimeout(async () => {
            logger.info({ message: 'Finalizando prueba de sensores.' });
            await Promise.all([publisherClient.disconnect(), subscriberClient.disconnect()]);
        }, 15000);
    } catch (error) {
        logger.error({ message: 'Error en el script principal', error: error.message });
    }
}

main();
