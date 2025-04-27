import { SensorFactory } from '../utils/SensorFactory.js';
import winston from 'winston';

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.printf(({ level, message, ...metadata }) => {
        const meta = Object.keys(metadata).length ? JSON.stringify(metadata) : '';
        return `[${new Date().toISOString()}] ${level.toUpperCase()}: ${message} ${meta}`;
    }),
    transports: [new winston.transports.Console()]
});

async function testDragonSensorPulse() {
    const sensor = SensorFactory.getInstance();
    let pulseCount = 0;
    const TOTAL_PULSES = 3;  // Probaremos 3 pulsos
    const PULSE_INTERVAL = 5000;  // Cada 5 segundos para test (en prod sería 60000)

    return new Promise((resolve, reject) => {
        const interval = setInterval(async () => {
            try {
                const pulse = {
                    timestamp: Date.now(),
                    type: 'DRAGON_AUTH_PULSE',
                    sensorId: 'DRAGON-PROD-001',
                    sequence: pulseCount + 1,
                    pulse: {
                        amplitude: 5.0,
                        frequency: 60.0,
                        status: 'active',
                        auth: {
                            checksum: Buffer.from(`${Date.now()}`).toString('base64'),
                            version: '1.0'
                        }
                    }
                };

                await sensor.setSensorData('dragon:pulse:latest', pulse);
                logger.info(`📡 Pulso ${pulseCount + 1}/${TOTAL_PULSES} enviado`, { 
                    sequence: pulse.sequence,
                    timestamp: new Date(pulse.timestamp).toISOString()
                });

                const received = await sensor.getSensorData('dragon:pulse:latest');
                if (received?.pulse?.status !== 'active') {
                    throw new Error('Estado del pulso incorrecto');
                }

                pulseCount++;

                if (pulseCount >= TOTAL_PULSES) {
                    clearInterval(interval);
                    logger.info('✅ Test de pulsos completado', { 
                        totalPulsos: TOTAL_PULSES,
                        intervalo: `${PULSE_INTERVAL}ms`
                    });
                    resolve(true);
                }

            } catch (error) {
                clearInterval(interval);
                logger.error('❌ Error en pulso', { error: error.message });
                reject(error);
            }
        }, PULSE_INTERVAL);
    });
}

// Ejecutar test de pulsos
logger.info('🔍 Iniciando prueba de pulsos periódicos...');
testDragonSensorPulse()
    .then(() => logger.info('🎉 Prueba finalizada exitosamente'))
    .catch(error => {
        logger.error('💥 Error en prueba:', { error: error.message });
        process.exit(1);
    });
