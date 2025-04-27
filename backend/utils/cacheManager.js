import { redis } from '../config/redis.js'; 
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
        new winston.transports.File({ filename: './logs/cache.log' })
    ]
});

class CacheManager {
    static #instance = null;
    #prefix = 'dragon:';
    #defaultTTL = 3600; // 1 hora

    static getInstance() {
        if (!CacheManager.#instance) {
            CacheManager.#instance = new CacheManager();
        }
        return CacheManager.#instance;
    }

    async get(key) {
        const startTime = process.hrtime();
        try {
            const data = await redis.get(this.#prefix + key);
            
            const [seconds, nanoseconds] = process.hrtime(startTime);
            const getTime = (seconds * 1000) + (nanoseconds / 1000000);
            
            if (getTime > 50) { // P95 para operaciones de caché
                logger.warn('⚠️ Cache get operation exceeded P95', {
                    operation: 'get',
                    key,
                    time: getTime
                });
            }

            return data ? JSON.parse(data) : null;
        } catch (error) {
            logger.error('🔴 Cache get error:', {
                key,
                error: error.message
            });
            return null;
        }
    }

    async set(key, value, ttl = this.#defaultTTL) {
        const startTime = process.hrtime();
        try {
            await redis.set(
                this.#prefix + key,
                JSON.stringify(value),
                'EX',
                ttl
            );

            const [seconds, nanoseconds] = process.hrtime(startTime);
            const setTime = (seconds * 1000) + (nanoseconds / 1000000);
            
            if (setTime > 50) {
                logger.warn('⚠️ Cache set operation exceeded P95', {
                    operation: 'set',
                    key,
                    time: setTime
                });
            }
        } catch (error) {
            logger.error('🔴 Cache set error:', {
                key,
                error: error.message
            });
        }
    }

    async invalidate(pattern) {
        try {
            const keys = await redis.keys(this.#prefix + pattern);
            if (keys.length > 0) {
                await redis.del(...keys);
                logger.info('🔄 Cache invalidated', { pattern, count: keys.length });
            }
        } catch (error) {
            logger.error('🔴 Cache invalidation error:', {
                pattern,
                error: error.message
            });
        }
    }
}

export default CacheManager;
