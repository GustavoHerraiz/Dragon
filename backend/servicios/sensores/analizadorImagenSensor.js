import { redis } from '../config/redis.js'; // Importaci�n con nombre
import { logger } from '../../config/logger.js';
import { DragonError } from '../../utils/DragonError.js';
import { DragonEye } from '../../utils/DragonEye.js';

const COMPONENT_NAME = 'analizadorImagenSensor';
const P95_THRESHOLD = 200; // milliseconds

class AnalizadorImagenSensor {
    #lastPulseTime = null;

    async emitirMetrica({ tiempoProcesamiento, confianza, decision }) {
        const now = Date.now();
        const intervalo = this.#lastPulseTime ? now - this.#lastPulseTime : null;

        try {
            // Emitir pulso a DragonEye
            redis.publish('dragon:pulse', JSON.stringify({
                ts: new Date().toISOString(),
                comp: COMPONENT_NAME,
                tiempoProcesamiento,
                confianza,
                decision,
                intervalo
            }));

            this.#lastPulseTime = now;

            // Validar si P95 supera el umbral
            if (tiempoProcesamiento > P95_THRESHOLD) {
                logger.warn('?? P95 threshold exceeded', {
                    tiempoProcesamiento,
                    threshold: P95_THRESHOLD,
                    ts: new Date().toISOString(),
                });
            }

            logger.info('?? M�trica emitida con �xito', {
                tiempoProcesamiento,
                confianza,
                decision,
            });
        } catch (error) {
            logger.error('? Error al emitir m�trica', {
                error: error.message,
                stack: error.stack,
            });
            throw new DragonError('SENSOR_EMIT_ERROR', error);
        }
    }
}

export default new AnalizadorImagenSensor();