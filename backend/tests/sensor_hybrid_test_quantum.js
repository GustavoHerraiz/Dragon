// Dragon Project - Sensor Hybrid Test Quantum
// Author: GustavoHerraiz
// Date: 2025-04-18
// Version: 3.0.2
// Component: Dragon Analyzer Test Suite
// Path: /var/www/ProyectoDragon/backend/tests/sensor_hybrid_test_quantum.js

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
            filename: '/var/log/dragon/sensors/hybrid_test_quantum.log'
        })
    ]
});

// Configuración del test
const SENSOR_CHANNEL = 'dragon:input:analyzer1_hand_right_color';
const PULSE_CHANNEL = 'dragon:pulse';
const P95_LIMIT = 200;
const TEST_TIMEOUT = 10000;

async function testHybridSensor() {
    const metrics = {
        startTime: Date.now(),
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
        metrics.connectionTime = Date.now() - metrics.startTime;
        
        logger.info('🔌 Conexiones Redis establecidas', {
            timestamp: new Date().toISOString(),
            component: 'sensor_hybrid_test',
            user: 'GustavoHerraiz',
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
                    metrics.totalTime = metrics.receiveTime - metrics.startTime;

                    pulseReceived = true;
                    logger.info('📡 Pulso recibido', {
                        timestamp: new Date().toISOString(),
                        component: data.comp,
                        user: 'GustavoHerraiz',
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

        // Generadores de datos optimizados
        const generateMatrix = (size) => 
            Array.from({ length: size }, () => 
                Array.from({ length: size }, () => Math.random())
            );

        const generateHistoricalSamples = (count) => 
            Array.from({ length: count }, (_, i) => ({
                timestamp: new Date().toISOString(),
                processTime: Math.floor(40 + Math.random() * 10),
                score: 0.98 + Math.random() * 0.02
            }));

        const testPulse = {
            id: "analyzer1_hand_right_color",
            timestamp: new Date().toISOString(),
            version: "3.0.2",
            testId: crypto.randomUUID(),
            user: "GustavoHerraiz",

            systemStatus: {
                health: "ok",
                uptime: Math.floor(Math.random() * 86400),
                lastError: null,
                errorRate: 0.001,
                queueLength: Math.floor(Math.random() * 5),
                processingLoad: Math.random() * 0.6,
                memoryUsage: Math.random() * 0.4
            },

            imageAnalysis: {
                colorMatrix: generateMatrix(32),
                keyPoints: {
                    detected: Math.floor(120 + Math.random() * 10),
                    matched: Math.floor(115 + Math.random() * 10),
                    confidence: 0.95 + Math.random() * 0.04
                },
                spectralData: Array.from({ length: 256 }, () => Math.random()),
                quality: {
                    brightness: 0.7 + Math.random() * 0.2,
                    contrast: 0.8 + Math.random() * 0.15,
                    sharpness: 0.85 + Math.random() * 0.1,
                    noise: Math.random() * 0.05
                }
            },

            authMetrics: {
                matchScore: 0.97 + Math.random() * 0.025,
                falsePositiveRate: 0.001,
                falseNegativeRate: 0.002,
                avgResponseTime: Math.floor(40 + Math.random() * 10),
                lastResults: generateHistoricalSamples(5)
            },

            calibration: {
                lastCalibration: new Date().toISOString(),
                driftFactor: Math.random() * 0.004,
                temperatureDelta: Math.random(),
                lightConditions: {
                    intensity: 800 + Math.random() * 100,
                    uniformity: 0.9 + Math.random() * 0.08
                },
                matrices: {
                    correction: generateMatrix(16),
                    compensation: generateMatrix(16)
                }
            },

            networkMetrics: {
                latency: Math.floor(8 + Math.random() * 4),
                packetLoss: Math.random() * 0.002,
                bandwidth: 40 + Math.random() * 10,
                connections: {
                    active: Math.floor(2 + Math.random() * 2),
                    pending: 0,
                    failed: 0
                }
            },

            qualityMetrics: {
                signalToNoise: 40 + Math.random() * 5,
                accuracy: 0.995 + Math.random() * 0.004,
                precision: 0.993 + Math.random() * 0.004,
                recall: 0.994 + Math.random() * 0.004,
                f1Score: 0.994 + Math.random() * 0.004
            },

            history: {
                errors: [],
                calibrationDrift: Array.from({ length: 5 }, () => Math.random() * 0.003),
                performanceMetrics: generateHistoricalSamples(5)
            }
        };

        const serializedPulse = JSON.stringify(testPulse);
        metrics.payloadSize = Buffer.from(serializedPulse).length;

        metrics.sendTime = Date.now();
        logger.info('📤 Enviando pulso', {
            timestamp: new Date().toISOString(),
            testId: testPulse.testId,
            user: 'GustavoHerraiz',
            channel: SENSOR_CHANNEL,
            metrics: {
                timeSinceStart: metrics.sendTime - metrics.startTime,
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
        try {
            await Promise.all([
                publisher.quit().catch(e => {
                    throw new DragonError('REDIS_DISCONNECT_ERROR', `Publisher disconnect error: ${e.message}`);
                }),
                subscriber.quit().catch(e => {
                    throw new DragonError('REDIS_DISCONNECT_ERROR', `Subscriber disconnect error: ${e.message}`);
                })
            ]);
            
            logger.info('🔌 Conexiones Redis cerradas', {
                timestamp: new Date().toISOString(),
                component: 'sensor_hybrid_test',
                user: 'GustavoHerraiz',
                pulseReceived,
                metrics: {
                    totalDuration: Date.now() - metrics.startTime,
                    payloadSize: metrics.payloadSize,
                    ...metrics
                }
            });
        } catch (error) {
            logger.error('❌ Error al desconectar Redis', {
                error: error instanceof DragonError ? error.toJSON() : error.message,
                timestamp: new Date().toISOString(),
                user: 'GustavoHerraiz'
            });
        }
    }
}

testHybridSensor()
    .then(({response, metrics}) => {
        logger.info('✅ Test completado', {
            timestamp: new Date().toISOString(),
            status: 'success',
            user: 'GustavoHerraiz',
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
            user: 'GustavoHerraiz',
            status: 'failed'
        });
        process.exit(1);
    });
