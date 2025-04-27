/**
 * Logger para Red Superior
 * Proyecto Dragón - v1.0.0
 * @author GustavoHerraiz
 * @date 2025-04-16 09:41:21
 */

import winston from 'winston';

export const createDragonEyeLogger = (service) => {
    return winston.createLogger({
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
        ),
        defaultMeta: { service },
        transports: [
            new winston.transports.File({ 
                filename: 'logs/error.log', 
                level: 'error',
                maxsize: 5242880, // 5MB
                maxFiles: 5
            }),
            new winston.transports.File({ 
                filename: 'logs/combined.log',
                maxsize: 5242880, // 5MB
                maxFiles: 5
            })
        ]
    });
};
