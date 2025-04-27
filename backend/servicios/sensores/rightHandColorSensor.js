import { redis } from '../../config/redis.js';
import { logger } from '../../config/logger.js';
import { DragonError } from '../../utils/DragonError.js';
import { SensorFactory, SENSOR_CHANNELS } from '../../utils/SensorFactory.js';

const COMPONENT_NAME = 'analyzer1_hand_right_color';
const P95_THRESHOLD = 200; // milliseconds

class RightHandColorSensor {
    #sensitivity = 1.0;
    #type = 'RIGHT_HAND_COLOR';
    #channel = SENSOR_CHANNELS.RIGHT_HAND_COLOR;
    #factory = null;
    #lastPulseTime = null;

    constructor() {
        logger.info('Initializing RightHandColorSensor', {
            component: COMPONENT_NAME,
            ts: new Date().toISOString()
        });

        try {
            this.#factory = SensorFactory.getInstance();
            this.#factory.registerSensor(this.#type, this);
            this.initializeRedisListener();
        } catch (error) {
            logger.error('Failed to initialize RightHandColorSensor', {
                component: COMPONENT_NAME,
                error: error.message,
                stack: error.stack
            });
            throw new DragonError('SENSOR_INIT_ERROR', error);
        }
    }

    initializeRedisListener() {
        redis.on('message', (channel, message) => {
            if (channel !== this.#channel) return;

            const startTime = process.hrtime();
            
            try {
                const data = JSON.parse(message);
                this.#validateInput(data);
                this.#sensitivity = data.value;

                const [seconds, nanoseconds] = process.hrtime(startTime);
                const processingTime = (seconds * 1000) + (nanoseconds / 1000000);

                this.emitPulse(processingTime);

                // Monitor P95
                if (processingTime > P95_THRESHOLD) {
                    logger.warn('P95 threshold exceeded', {
                        component: COMPONENT_NAME,
                        processingTime,
                        threshold: P95_THRESHOLD,
                        ts: new Date().toISOString()
                    });
                }

            } catch (error) {
                logger.error('Error processing sensor data', {
                    component: COMPONENT_NAME,
                    error: error.message,
                    rawMessage: message,
                    ts: new Date().toISOString()
                });
                throw new DragonError('SENSOR_INPUT_ERROR', error, { channel });
            }
        });

        logger.info('Redis listener initialized', {
            component: COMPONENT_NAME,
            channel: this.#channel
        });
    }

    #validateInput(data) {
        if (!data || typeof data.value !== 'number' || data.value < 0 || data.value > 1) {
            throw new DragonError('INVALID_INPUT', null, {
                received: data,
                expectedRange: '0 to 1',
                component: COMPONENT_NAME
            });
        }
    }

    emitPulse(tiempoMS) {
        const now = Date.now();
        try {
            redis.publish('dragon:pulse', JSON.stringify({
                ts: new Date().toISOString().slice(0,19).replace('T',' '),
                comp: COMPONENT_NAME,
                t: tiempoMS,
                interval: this.#lastPulseTime ? now - this.#lastPulseTime : null
            }));

            this.#lastPulseTime = now;

            logger.debug('Pulse emitted', {
                component: COMPONENT_NAME,
                responseTime: tiempoMS,
                ts: new Date().toISOString()
            });

        } catch (error) {
            logger.error('Failed to emit pulse', {
                component: COMPONENT_NAME,
                error: error.message,
                ts: new Date().toISOString()
            });
            throw new DragonError('SENSOR_EMIT_ERROR', error);
        }
    }

    // Métodos para testing y monitoreo
    getSensitivity() {
        return this.#sensitivity;
    }

    getChannel() {
        return this.#channel;
    }
}

// Exportamos una única instancia (Singleton)
export default new RightHandColorSensor();
