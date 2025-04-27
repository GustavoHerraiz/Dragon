import winston from 'winston';
import path from 'path';

export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    defaultMeta: { service: 'red-superior' },
    transports: [
        new winston.transports.File({ 
            filename: path.join('/var/www/ProyectoDragon/backend/logs', 'red-superior-error.log'),
            level: 'error'
        }),
        new winston.transports.File({ 
            filename: path.join('/var/www/ProyectoDragon/backend/logs', 'red-superior.log')
        })
    ]
});

export default logger;
