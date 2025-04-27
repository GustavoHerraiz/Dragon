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
            filename: '/var/log/dragon/sensors/hybrid_test_maxpayload.log'
        })
    ]
});

const SENSOR_CHANNEL = 'dragon:input:analyzer1_hand_right_color';
const PULSE_CHANNEL = 'dragon:pulse';
const P95_LIMIT = 200;
const TEST_TIMEOUT = 10000;

async function testHybridSensor() {
    const startTime = Date.now();
    const metrics = {
        connectionTime: null,
        sendTime: null,
        receiveTime: null,
        processingTime: null,
        totalTime: null,
        networkLatency: null,
        payloadSize: null
    };

    const publisher = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    
    const subscriber = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    let pulseReceived = false;

    try {
        await Promise.all([publisher.connect(), subscriber.connect()]);
        metrics.connectionTime = Date.now() - startTime;
        
        logger.info('🔌 Conexiones Redis establecidas', {
            timestamp: new Date().toISOString(),
            component: 'sensor_hybrid_test',
            channels: {
                publish: SENSOR_CHANNEL,
                subscribe: PULSE_CHANNEL
            },
            metrics: {
                connectionTime: metrics.connectionTime
            }
        });

        const pulsePromise = new Promise((resolve, reject) => {
            subscriber.subscribe(PULSE_CHANNEL, (message) => {
                try {
                    const data = JSON.parse(message);
                    metrics.receiveTime = Date.now();
                    metrics.processingTime = data.processingTime;
                    metrics.networkLatency = metrics.receiveTime - metrics.sendTime - metrics.processingTime;
                    metrics.totalTime = metrics.receiveTime - startTime;

                    pulseReceived = true;
                    logger.info('📡 Pulso recibido', {
                        timestamp: new Date().toISOString(),
                        component: data.comp,
                        metrics: {
                            processingTime: metrics.processingTime,
                            networkLatency: metrics.networkLatency,
                            totalTime: metrics.totalTime,
                            payloadSize: metrics.payloadSize
                        },
                        p95Status: metrics.totalTime <= P95_LIMIT ? 'ok' : 'exceeded',
                        originalTestId: data.originalTestId
                    });

                    resolve(data);
                } catch (error) {
                    reject(new DragonError('PULSE_PROCESS_ERROR', error));
                }
            });
        });

        // Payload máximo enriquecido
        const generateColorProfile = (depth = 50) => {
            return Array.from({ length: depth }, (_, i) => ({
                r: Math.floor(Math.random() * 255),
                g: Math.floor(Math.random() * 255),
                b: Math.floor(Math.random() * 255),
                frequency: Math.random(),
                confidence: Math.random(),
                depth: i,
                location: {
                    x: Math.floor(Math.random() * 1000),
                    y: Math.floor(Math.random() * 1000),
                    width: Math.floor(Math.random() * 100),
                    height: Math.floor(Math.random() * 100)
                }
            }));
        };

        const testPulse = {
            value: 1.5,
            timestamp: new Date().toISOString(),
            source: 'DragonEye',
            target: 'analyzer1_hand_right_color',
            testId: crypto.randomUUID(),
            imageData: {
                metadata: {
                    device: {
                        name: 'DragonEye Pro',
                        version: '2.0.1',
                        calibration: {
                            lastDate: new Date().toISOString(),
                            matrix: Array.from({ length: 9 }, () => Math.random()),
                            temperature: 23.5,
                            humidity: 45
                        }
                    },
                    capture: {
                        exposure: 1/1000,
                        iso: 400,
                        aperture: 2.8,
                        focalLength: 50,
                        resolution: { width: 4096, height: 3072 }
                    }
                },
                analysis: {
                    colorProfiles: {
                        main: generateColorProfile(50),
                        secondary: generateColorProfile(30),
                        tertiary: generateColorProfile(20)
                    },
                    patterns: Array.from({ length: 20 }, (_, i) => ({
                        type: ['circular', 'linear', 'radial', 'mesh', 'gradient'][i % 5],
                        confidence: Math.random(),
                        strength: Math.random(),
                        location: {
                            x: Math.floor(Math.random() * 1000),
                            y: Math.floor(Math.random() * 1000),
                            width: Math.floor(Math.random() * 100),
                            height: Math.floor(Math.random() * 100)
                        },
                        metrics: {
                            density: Math.random(),
                            regularity: Math.random(),
                            contrast: Math.random(),
                            entropy: Math.random()
                        }
                    })),
                    quality: {
                        overall: Math.random(),
                        metrics: {
                            sharpness: Math.random(),
                            noise: Math.random(),
                            contrast: Math.random(),
                            saturation: Math.random(),
                            exposure: Math.random(),
                            colorBalance: Math.random(),
                            compression: Math.random()
                        },
                        regions: Array.from({ length: 16 }, () => ({
                            quality: Math.random(),
                            location: {
                                x: Math.floor(Math.random() * 1000),
                                y: Math.floor(Math.random() * 1000),
                                width: Math.floor(Math.random() * 100),
                                height: Math.floor(Math.random() * 100)
                            }
                        }))
                    },
                    processingSteps: Array.from({ length: 10 }, (_, i) => ({
                        name: `step_${i}`,
                        duration: Math.random() * 10,
                        status: 'completed',
                        metrics: {
                            cpu: Math.random(),
                            memory: Math.random(),
                            confidence: Math.random()
                        }
                    }))
                }
            }
        };

        const serializedPulse = JSON.stringify(testPulse);
        metrics.payloadSize = Buffer.from(serializedPulse).length;

        metrics.sendTime = Date.now();
        logger.info('📤 Enviando pulso', {
            timestamp: testPulse.timestamp,
            testId: testPulse.testId,
            channel: SENSOR_CHANNEL,
            metrics: {
                timeSinceStart: metrics.sendTime - startTime,
                payloadSize: metrics.payloadSize
            }
        });

        await publisher.publish(SENSOR_CHANNEL, serializedPulse);

        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new DragonError('TEST_TIMEOUT', 'No se recibió respuesta del sensor'));
            }, TEST_TIMEOUT);
        });

        const response = await Promise.race([pulsePromise, timeoutPromise]);

        return { response, metrics };

    } catch (error) {
        throw new DragonError('TEST_ERROR', error);
    } finally {
        await Promise.all([
            publisher.quit(),
            subscriber.quit()
        ]).catch(error => {
            logger.error('❌ Error al desconectar Redis', {
                error: error.message
            });
        });
        
        logger.info('🔌 Conexiones Redis cerradas', {
            timestamp: new Date().toISOString(),
            component: 'sensor_hybrid_test',
            pulseReceived,
            metrics: {
                totalDuration: Date.now() - startTime,
                payloadSize: metrics.payloadSize,
                ...metrics
            }
        });
    }
}

testHybridSensor()
    .then(({response, metrics}) => {
        logger.info('✅ Test completado', {
            timestamp: new Date().toISOString(),
            status: 'success',
            metrics: {
                connectionTime: metrics.connectionTime,
                processingTime: metrics.processingTime,
                networkLatency: metrics.networkLatency,
                totalTime: metrics.totalTime,
                payloadSize: metrics.payloadSize,
                p95Status: metrics.totalTime <= P95_LIMIT ? 'ok' : 'exceeded'
            }
        });
        setTimeout(() => process.exit(0), 1000);
    })
    .catch((error) => {
        logger.error('❌ Test fallido', {
            timestamp: new Date().toISOString(),
            error: error instanceof DragonError ? error.toJSON() : error.message,
            status: 'failed'
        });
        process.exit(1);
    });
