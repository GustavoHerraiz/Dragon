import { createClient } from 'redis';
import winston from 'winston';
import { DragonError } from '../utils/DragonError.js';

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        }),
        new winston.transports.File({ 
            filename: '/var/log/dragon/analyzers/analyzer1_hand_right_color.log'
        })
    ]
});

const INPUT_CHANNEL = 'dragon:input:analyzer1_hand_right_color';
const OUTPUT_CHANNEL = 'dragon:pulse';
const P95_LIMIT = 200;

async function startAnalyzer() {
    const subscriber = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    
    const publisher = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    try {
        await Promise.all([subscriber.connect(), publisher.connect()]);
        logger.info('🔌 Analizador iniciado', {
            component: 'analyzer1_hand_right_color',
            channels: {
                input: INPUT_CHANNEL,
                output: OUTPUT_CHANNEL
            }
        });

        await subscriber.subscribe(INPUT_CHANNEL, async (message) => {
            const startTime = Date.now();
            try {
                const input = JSON.parse(message);
                
                logger.info('📥 Pulso recibido', {
                    component: 'analyzer1_hand_right_color',
                    testId: input.testId,
                    timestamp: input.timestamp
                });

                // Procesar el pulso
                const response = {
                    ts: new Date().toISOString(),
                    comp: 'analyzer1_hand_right_color',
                    value: input.value,
                    originalTestId: input.testId,
                    processingTime: Date.now() - startTime
                };

                // Publicar respuesta
                logger.info('📤 Enviando respuesta', {
                    component: 'analyzer1_hand_right_color',
                    channel: OUTPUT_CHANNEL,
                    response: response
                });

                const publishResult = await publisher.publish(OUTPUT_CHANNEL, JSON.stringify(response));

                const totalTime = Date.now() - startTime;
                logger.info('📡 Pulso procesado', {
                    component: 'analyzer1_hand_right_color',
                    processingTime: totalTime,
                    p95Status: totalTime <= P95_LIMIT ? 'ok' : 'exceeded',
                    testId: input.testId,
                    publishResult: publishResult
                });

            } catch (error) {
                logger.error('❌ Error procesando pulso', {
                    error: error instanceof DragonError ? error.toJSON() : error.message,
                    component: 'analyzer1_hand_right_color'
                });
            }
        });

    } catch (error) {
        logger.error('❌ Error fatal en analizador', {
            error: error instanceof DragonError ? error.toJSON() : error.message,
            component: 'analyzer1_hand_right_color'
        });
        process.exit(1);
    }
}

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
    logger.error('❌ Error no capturado', {
        error: error instanceof DragonError ? error.toJSON() : error.message,
        component: 'analyzer1_hand_right_color'
    });
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    logger.error('❌ Promesa rechazada no manejada', {
        error: reason instanceof DragonError ? reason.toJSON() : reason,
        component: 'analyzer1_hand_right_color'
    });
    process.exit(1);
});

startAnalyzer().catch((error) => {
    logger.error('❌ Error iniciando analizador', {
        error: error instanceof DragonError ? error.toJSON() : error.message,
        component: 'analyzer1_hand_right_color'
    });
    process.exit(1);
});
