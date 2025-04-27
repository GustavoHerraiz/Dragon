import Redis from 'ioredis';
import winston from 'winston';
import { EventEmitter } from 'events';
import path from 'path';

class DragonEye extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.activeSensors = new Map();
        this.metrics = {
            eventsProcessed: 0,
            errorCount: 0,
            lastProcessingTime: null
        };

        this.setupLogger(options);
        this.setupRedis();
        this.setupHealthCheck();
        this.setupPerformanceMonitoring();
    }

    setupLogger(options) {
        this.logger = winston.createLogger({
            level: options.logLevel || 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            defaultMeta: { service: 'DragonEye' },
            transports: [
                new winston.transports.File({ 
                    filename: path.join('/var/www/ProyectoDragon/backend/logs', 'dragon-eye-error.log'),
                    level: 'error'
                }),
                new winston.transports.File({ 
                    filename: path.join('/var/www/ProyectoDragon/backend/logs', 'dragon-eye.log')
                })
            ]
        });
    }

    setupRedis() {
        this.redis = new Redis({
            retryStrategy(times) {
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
            maxRetriesPerRequest: 3,
            enableReadyCheck: true,
            showFriendlyErrorStack: process.env.NODE_ENV !== 'production'
        });

        this.redis.on('error', (err) => {
            this.logger.error('Redis connection error', { 
                error: err.message,
                stack: err.stack 
            });
            this.emit('error', err);
        });

        this.redis.on('connect', () => {
            this.logger.info('Redis connected successfully');
            this.emit('connect');
        });

        this.redis.subscribe('dragon:events:superior', (err) => {
            if (err) {
                this.logger.error('Subscription error', { 
                    error: err.message,
                    stack: err.stack 
                });
                return;
            }
            this.logger.info('Subscribed to dragon:events:superior channel');
        });

        this.redis.on('message', this.handleIncomingMessage.bind(this));
    }

    async handleIncomingMessage(channel, message) {
        const startTime = process.hrtime();

        try {
            const data = JSON.parse(message);
            await this.handleSensorEvent(data);
            
            const [seconds, nanoseconds] = process.hrtime(startTime);
            const duration = seconds * 1000 + nanoseconds / 1000000;

            this.metrics.eventsProcessed++;
            this.metrics.lastProcessingTime = duration;

            if (duration > 200) {
                this.logger.warn('Event processing exceeded P95 target', { 
                    duration,
                    eventType: data.type 
                });
            }
        } catch (error) {
            this.metrics.errorCount++;
            this.logger.error('Error processing message', { 
                error: error.message,
                stack: error.stack,
                channel,
                message 
            });
        }
    }

    setupHealthCheck() {
        setInterval(() => {
            this.checkSensorsHealth();
        }, 30000);
    }

    setupPerformanceMonitoring() {
        setInterval(() => {
            if (this.metrics.eventsProcessed > 0) {
                this.logger.info('Performance metrics', { ...this.metrics });
            }
            this.metrics.eventsProcessed = 0;
            this.metrics.errorCount = 0;
        }, 60000);
    }

    async handleSensorEvent(data) {
        try {
            const { nodeId, componentName, type, timestamp } = data;
            
            if (!nodeId || !componentName) {
                throw new Error('Invalid event data: missing required fields');
            }

            if (type === 'shutdown') {
                this.activeSensors.delete(nodeId);
                this.logger.info('Sensor shutdown registered', { nodeId, componentName });
                this.emit('sensorShutdown', { nodeId, componentName });
                return;
            }

            this.activeSensors.set(nodeId, {
                componentName,
                lastSeen: Date.now(),
                status: 'active',
                nodeId,
                metrics: data.metrics || {}
            });

            this.logger.debug('Event processed', { 
                type,
                componentName,
                nodeId,
                timestamp 
            });
            
            this.emit('event', data);
        } catch (error) {
            this.logger.error('Error handling sensor event', { 
                error: error.message,
                stack: error.stack,
                data 
            });
            throw error;
        }
    }

    checkSensorsHealth() {
        const now = Date.now();
        this.activeSensors.forEach((sensor, nodeId) => {
            const timeSinceLastSeen = now - sensor.lastSeen;
            if (timeSinceLastSeen > 60000) {
                this.logger.warn('Sensor timeout detected', {
                    nodeId,
                    componentName: sensor.componentName,
                    timeSinceLastSeen
                });
                this.activeSensors.delete(nodeId);
                this.emit('sensorTimeout', { 
                    nodeId, 
                    componentName: sensor.componentName 
                });
            }
        });
    }

    async close() {
        try {
            await this.redis.quit();
            this.logger.info('DragonEye shutdown complete');
        } catch (error) {
            this.logger.error('Error during shutdown', { 
                error: error.message,
                stack: error.stack 
            });
            throw error;
        }
    }

    getSensorsStatus() {
        return Array.from(this.activeSensors.values());
    }

    async isHealthy() {
        return {
            status: this.redis.status === 'ready',
            activeSensors: this.activeSensors.size,
            metrics: this.metrics
        };
    }
}

export { DragonEye };
