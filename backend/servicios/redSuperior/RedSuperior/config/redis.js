import { createClient } from 'redis';
import { logger } from '../utils/logger.js';

const redis = createClient({
    url: 'redis://127.0.0.1:6379', // Configuración de Redis
});

redis.on('connect', () => {
    logger.info('Conectado a Redis correctamente.');
});

redis.on('error', (err) => {
    logger.error(`Error en Redis: ${err.message}`);
    process.exit(1);
});

export { redis };