import redis from '../../config/redis.js';
import { logger } from '../../config/logger.js';
import { DragonError } from '../../utils/DragonError.js';
import SENSOR_CHANNELS from '../../utils/SensorChannels.js';

const COMPONENT_NAME = 'analizador_imagen'; // Nombre espec�fico para el componente

class AnalizadorImagenSensor {
    #type = 'ANALIZADOR_IMAGEN';
    #channel = SENSOR_CHANNELS?.analizadorImagen; // Validar que el canal existe
    #lastPulseTime = null;

    /**
     * Inicializa el sensor registr�ndolo en la f�brica.
     * @param {SensorFactory} sensorFactory - Instancia de la f�brica de sensores
     */
    initialize(sensorFactory) {
        try {
            // Validar que la f�brica es v�lida
            if (!sensorFactory || typeof sensorFactory.registerSensor !== 'function') {
                throw new DragonError('SENSOR_FACTORY_UNDEFINED', null, {
                    message: `SensorFactory no est� definido o no es v�lido.`,
                    component: COMPONENT_NAME
                });
            }

            // Registrar este sensor en la f�brica
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
     * Registra par�metros proporcionados y emite un pulso.
     * @param {Object} parametros - Datos proporcionados por el an�lisis
     */
    registrarParametrosYEmitirPulso(parametros) {
        try {
            // Validar que los par�metros sean v�lidos
            if (!parametros || typeof parametros !== 'object') {
                throw new DragonError('INVALID_PARAMETERS', null, {
                    message: `Par�metros inv�lidos proporcionados al sensor.`,
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
            logger.error(`? Error al registrar par�metros o emitir el pulso: ${error.message}`, {
                component: COMPONENT_NAME,
                stack: error.stack
            });
            throw new DragonError('SENSOR_EMIT_ERROR', error, {
                component: COMPONENT_NAME
            });
        }
    }

    /**
     * Emite m�tricas espec�ficas del an�lisis.
     * @param {Object} metricas - M�tricas calculadas del an�lisis
     */
    emitirMetrica(metricas) {
        try {
            // Validar que las m�tricas sean v�lidas
            if (!metricas || typeof metricas !== 'object') {
                throw new DragonError('INVALID_METRICS', null, {
                    message: `M�tricas inv�lidas proporcionadas al sensor.`,
                    component: COMPONENT_NAME
                });
            }

            // Log antes de publicar en Redis
            logger.info('?? Preparando para emitir m�tricas:', {
                canal: 'dragon:metrics',
                metricas
            });

            // Crear el objeto de m�trica para enviar
            const metricaData = {
                ts: new Date().toISOString(),
                comp: COMPONENT_NAME,
                metricas
            };

            // Publicar m�tricas en Redis
            redis.publish('dragon:metrics', JSON.stringify(metricaData));

            // Confirmar que se ha publicado correctamente
            logger.info('? M�tricas publicadas correctamente en Redis', {
                canal: 'dragon:metrics',
                metricas: metricaData.metricas
            });
        } catch (error) {
            logger.error(`? Error al emitir m�tricas: ${error.message}`, {
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