import Redis from 'ioredis';
import winston from 'winston';

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
        new winston.transports.File({ filename: './logs/redis.log' })
    ]
});

const redis = new Redis({
    retryStrategy(times) {
        const delay = Math.min(times * 50, 2000); // Incremento exponencial con límite
        return delay;
    },
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    autoResubscribe: true,
    autoResendUnfulfilledCommands: true,
    lazyConnect: true,
    connectTimeout: 10000, // Timeout de conexión
    keepAlive: 30000, // Mantener conexión viva
    noDelay: true, // Deshabilitar algoritmo de Nagle
    commandTimeout: 5000 // Timeout para comandos individuales
});

redis.on('ready', () => {
    logger.info('Redis connection established.');
});

redis.on('error', (err) => {
    logger.error(`Redis connection error: ${err.message}`, { stack: err.stack });
});

redis.on('close', () => {
    logger.warn('Redis connection closed.');
});

redis.on('reconnecting', (delay) => {
    logger.info(`Attempting to reconnect to Redis in ${delay}ms.`);
});

redis.on('end', () => {
    logger.warn('Redis connection has ended.');
});

export { redis };
export default redis;