import { redis } from '../config/redis.js';
import { logger } from '../utils/logger.js';
import { DragonError } from '../utils/DragonError.js';

const PULSE_CHANNEL = 'dragon:pulse:redSuperior';
let pulseIntervalMS = 1000; // Por defecto, un pulso cada segundo.

const emitPulse = (component, tiempoMS) => {
    try {
        const pulseData = {
            ts: new Date().toISOString().slice(0,19).replace('T', ' '),
            comp: component,
            t: tiempoMS
        };

        redis.publish(PULSE_CHANNEL, JSON.stringify(pulseData));

        logger.info(`A pulse is sent.\nTime flows in silence.\n${JSON.stringify(pulseData)}`);
    } catch (error) {
        logger.error(`Failed to emit pulse.\nA broken rhythm.\n${error.message}`);
        throw new DragonError('PULSE_EMIT_ERROR', error);
    }
};

const monitorPulses = () => {
    redis.on('message', (channel, msg) => {
        if (channel !== PULSE_CHANNEL) return;

        try {
            const { ts, comp, t } = JSON.parse(msg);
            logger.info(`Pulse received at ${ts}.\n${comp} beats steady.\nDuration: ${t}ms.`);
        } catch (error) {
            logger.error(`Pulse parsing failed.\nChaos in the stream.\n${error.message}`);
            throw new DragonError('PULSE_PARSE_ERROR', error);
        }
    });

    redis.subscribe(PULSE_CHANNEL);
    logger.info('Listening for pulses.\nThe stream whispers soft.\nChannel: dragon:pulse:redSuperior.');
};

const setPulseInterval = (intervalMS) => {
    if (typeof intervalMS !== 'number' || intervalMS <= 0) {
        throw new DragonError('INVALID_PULSE_INTERVAL', 'Pulse interval must be a positive number.');
    }

    pulseIntervalMS = intervalMS;
    logger.info(`Interval adjusted.\nTime bends to new beats.\nNew interval: ${pulseIntervalMS}ms.`);
};

export { emitPulse, monitorPulses, setPulseInterval };
