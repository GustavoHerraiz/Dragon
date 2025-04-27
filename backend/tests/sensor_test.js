import { SensorFactory } from '../utils/SensorFactory.js';
import winston from 'winston';

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.printf(({ level, message }) => 
        `[${new Date().toISOString()}] ${level.toUpperCase()}: ${message}`
    ),
    transports: [new winston.transports.Console()]
});

async function testSensorPulse() {
    try {
        const sensor = SensorFactory.getInstance();
        logger.info('🔍 Iniciando prueba de pulso del sensor...');

        // Generar pulso de prueba
        const pulso = {
            timestamp: Date.now(),
            type: 'PULSE',
            sensorId: 'DRAGON-001',
            pulse: {
                amplitude: 5.0,
                frequency: 60.0,
                waveform: 'sinusoidal',
                status: 'active'
            },
            metadata: {
                location: 'test-chamber',
                testId: `TEST-${Date.now()}`
            }
        };

        // Enviar pulso
        logger.info('📡 Enviando pulso de prueba...');
        await sensor.setSensorData('pulse:latest', pulso);

        // Verificar que el pulso se registró
        const retrievedPulse = await sensor.getSensorData('pulse:latest');
        
        if (!retrievedPulse) {
            throw new Error('No se recibió pulso del sensor');
        }

        logger.info('📊 Pulso recibido:', {
            timestamp: new Date(retrievedPulse.timestamp).toISOString(),
            sensorId: retrievedPulse.sensorId,
            status: retrievedPulse.pulse.status
        });

        if (retrievedPulse.pulse.status === 'active') {
            logger.info('✅ Pulso verificado y activo');
            return true;
        } else {
            throw new Error('Pulso inactivo o en estado incorrecto');
        }

    } catch (error) {
        logger.error('❌ Test de pulso fallido: ' + error.message);
        throw error;
    }
}

// Ejecutar test de pulso
testSensorPulse()
    .then(() => logger.info('🎉 Prueba de pulso completada'))
    .catch(error => {
        logger.error('💥 Error en prueba de pulso: ' + error.message);
        process.exit(1);
    });
