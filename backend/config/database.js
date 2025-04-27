import mongoose from 'mongoose';
import winston from 'winston';
import CacheManager from '../utils/cacheManager.js';

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
        new winston.transports.File({ filename: './logs/database.log' })
    ]
});

mongoose.set('strictQuery', true);

const conectarDB = async () => {
    const startTime = process.hrtime();
    const cache = CacheManager.getInstance();

    try {
        // Configuración optimizada y compatible
        const config = {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            maxPoolSize: 20,
            minPoolSize: 10,
            socketTimeoutMS: 30000,
            connectTimeoutMS: 5000,
            serverSelectionTimeoutMS: 3000,
            heartbeatFrequencyMS: 1000,
            retryWrites: true,
            w: 'majority',
            keepAlive: true,
            keepAliveInitialDelay: 150000,
            autoIndex: false,
            bufferCommands: false
        };

        // Cachear configuración para futuras conexiones
        await cache.set('mongodb:config', config);

        await mongoose.connect(process.env.MONGODB_URI, config);

        const [seconds, nanoseconds] = process.hrtime(startTime);
        const connectTime = (seconds * 1000) + (nanoseconds / 1000000);

        if (connectTime > 200) {
            logger.warn('⚠️ MongoDB connection time:', {
                time: connectTime,
                suggestion: 'Consider using replica set or adjusting network settings'
            });
        }

        // Monitorear eventos de conexión
        mongoose.connection.on('connected', () => {
            logger.info('🟢 MongoDB pool ready');
        });

        mongoose.connection.on('reconnected', () => {
            logger.info('🔄 MongoDB reconnected');
        });

        logger.info(`🟢 Connected to MongoDB: ${mongoose.connection.name}`);
        return true;
    } catch (error) {
        logger.error('🔴 MongoDB connection error:', {
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
};

// Monitoreo de métricas
setInterval(async () => {
    if (mongoose.connection.readyState === 1) { // Solo si está conectado
        try {
            const status = await mongoose.connection.db.admin().serverStatus();
            const metrics = {
                connections: status.connections,
                network: status.network,
                opcounters: status.opcounters
            };
            
            await CacheManager.getInstance().set('mongodb:metrics', metrics, 300);
            
            if (status.connections.current > status.connections.available * 0.8) {
                logger.warn('⚠️ High connection usage', metrics);
            }
        } catch (error) {
            // Silently fail for non-admin users
        }
    }
}, 60000);

// Manejo de errores y cierre graceful
mongoose.connection.on('error', (error) => {
    logger.error('🔴 MongoDB error:', {
        error: error.message
    });
});

mongoose.connection.on('disconnected', () => {
    logger.warn('🟡 MongoDB disconnected');
});

process.on('SIGINT', async () => {
    try {
        await mongoose.connection.close();
        logger.info('🟢 MongoDB connection closed');
        process.exit(0);
    } catch (error) {
        logger.error('🔴 MongoDB close error:', {
            error: error.message
        });
        process.exit(1);
    }
});

export default conectarDB;
