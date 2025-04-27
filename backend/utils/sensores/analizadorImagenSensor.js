import redis from '../../config/redis.js';
import { logger } from '../../config/logger.js';
import { DragonError } from '../../utils/DragonError.js';
import SENSOR_CHANNELS from '../../utils/SensorChannels.js';

const COMPONENT_NAME = 'analizador_imagen'; // Nombre específico para el componente

class AnalizadorImagenSensor {
    #type = 'ANALIZADOR_IMAGEN';
    #channel = SENSOR_CHANNELS?.analizadorImagen; // Validar que el canal existe
    #lastPulseTime = null;

    /**
     * Inicializa el sensor registrándolo en la fábrica.
     * @param {SensorFactory} sensorFactory - Instancia de la fábrica de sensores
     */
    initialize(sensorFactory) {
        try {
            // Validar que la fábrica es válida
            if (!sensorFactory || typeof sensorFactory.registerSensor !== 'function') {
                throw new DragonError('SENSOR_FACTORY_UNDEFINED', null, {
                    message: `SensorFactory no está definido o no es válido.`,
                    component: COMPONENT_NAME
                });
            }

            // Registrar este sensor en la fábrica
            sensorFactory.registerSensor(this.#type, this);

            logger.info(`${COMPONENT_NAME} registrado correctamente.`);
        } catch (error) {
            logger.error(`Error al inicializar ${COMPONENT_NAME}: ${error.message}`, { error });
            throw new DragonError('SENSOR_INIT_ERROR', error, {
                component: COMPONENT_NAME
            });
        }
    }

    /**
     * Registra parámetros proporcionados y emite un pulso.
     * @param {Object} parametros - Datos proporcionados por el análisis
     */
    registrarParametrosYEmitirPulso(parametros) {
        try {
            // Validar que los parámetros sean válidos
            if (!parametros || typeof parametros !== 'object') {
                throw new DragonError('INVALID_PARAMETERS', null, {
                    message: `Parámetros inválidos proporcionados al sensor.`,
                    component: COMPONENT_NAME
                });
            }

            const now = Date.now();

            // Emitir el pulso
            const pulso = {
                ts: new Date().toISOString(),
                comp: COMPONENT_NAME,
                parametros,
                interval: this.#lastPulseTime ? now - this.#lastPulseTime : null
            };

            // Log antes de publicar en Redis
            logger.info('?? Preparando para emitir pulso:', {
                canal: 'dragon:pulse',
                datos: pulso
            });

            redis.publish('dragon:pulse', JSON.stringify(pulso));

            this.#lastPulseTime = now;

            logger.info('? Pulso emitido correctamente', {
                component: COMPONENT_NAME,
                parametros,
                ts: pulso.ts,
                interval: pulso.interval
            });
        } catch (error) {
            logger.error(`? Error al registrar parámetros o emitir el pulso: ${error.message}`, {
                component: COMPONENT_NAME,
                stack: error.stack
            });
            throw new DragonError('SENSOR_EMIT_ERROR', error, {
                component: COMPONENT_NAME
            });
        }
    }

    /**
     * Emite métricas específicas del análisis.
     * @param {Object} metricas - Métricas calculadas del análisis
     */
    emitirMetrica(metricas) {
        try {
            // Validar que las métricas sean válidas
            if (!metricas || typeof metricas !== 'object') {
                throw new DragonError('INVALID_METRICS', null, {
                    message: `Métricas inválidas proporcionadas al sensor.`,
                    component: COMPONENT_NAME
                });
            }

            // Log antes de publicar en Redis
            logger.info('?? Preparando para emitir métricas:', {
                canal: 'dragon:metrics',
                metricas
            });

            // Crear el objeto de métrica para enviar
            const metricaData = {
                ts: new Date().toISOString(),
                comp: COMPONENT_NAME,
                metricas
            };

            // Publicar métricas en Redis
            redis.publish('dragon:metrics', JSON.stringify(metricaData));

            // Confirmar que se ha publicado correctamente
            logger.info('? Métricas publicadas correctamente en Redis', {
                canal: 'dragon:metrics',
                metricas: metricaData.metricas
            });
        } catch (error) {
            logger.error(`? Error al emitir métricas: ${error.message}`, {
                component: COMPONENT_NAME,
                stack: error.stack
            });
            throw new DragonError('METRICS_EMIT_ERROR', error, {
                component: COMPONENT_NAME
            });
        }
    }
}

export default new AnalizadorImagenSensor();