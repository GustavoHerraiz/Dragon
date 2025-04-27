import Redis from 'ioredis';
import winston from 'winston';
import path from 'path';

class DragonSensor {
    constructor(componentName, options = {}) {
        if (!componentName) {
            throw new Error('DragonSensor requires a componentName');
        }

        this.componentName = componentName;
        this.nodeId = Math.random().toString(36).substring(7);
        
        this.logger = winston.createLogger({
            level: options.logLevel || 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            defaultMeta: {
                service: 'DragonSensor',
                componentName: this.componentName,
                nodeId: this.nodeId
            },
            transports: [
                new winston.transports.File({ 
                    filename: path.join('/var/www/ProyectoDragon/backend/logs', 'dragon-sensor-error.log'),
                    level: 'error'
                }),
                new winston.transports.File({ 
                    filename: path.join('/var/www/ProyectoDragon/backend/logs', 'dragon-sensor.log')
                })
            ]
        });

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
                stack: err.stack,
                componentName: this.componentName
            });
        });

        this.redis.on('connect', () => {
            this.logger.info('Redis connected successfully', {
                componentName: this.componentName,
                nodeId: this.nodeId
            });
        });

        this.setupGracefulShutdown();
        this.startPerformanceMonitoring();
    }

    setupGracefulShutdown() {
        const shutdown = async () => {
            try {
                await this.close();
                process.exit(0);
            } catch (error) {
                this.logger.error('Error during shutdown', { 
                    error: error.message,
                    componentName: this.componentName
                });
                process.exit(1);
            }
        };

        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);
    }

    startPerformanceMonitoring() {
        this.metrics = {
            pulseCount: 0,
            errorCount: 0,
            lastPulseTime: null
        };

        setInterval(() => {
            if (this.metrics.pulseCount > 0) {
                this.logger.info('Performance metrics', {
                    ...this.metrics,
                    componentName: this.componentName
                });
            }
            this.metrics.pulseCount = 0;
            this.metrics.errorCount = 0;
        }, 60000);
    }

    async pulse(data) {
        const startTime = process.hrtime();
        
        try {
            if (this.redis.status !== 'ready') {
                throw new Error('Redis not connected');
            }

            const eventData = {
                ...data,
                nodeId: this.nodeId,
                componentName: this.componentName,
                timestamp: new Date().toISOString()
            };

            await this.redis.publish('dragon:events:superior', JSON.stringify(eventData));
            
            const [seconds, nanoseconds] = process.hrtime(startTime);
            const duration = seconds * 1000 + nanoseconds / 1000000;

            this.metrics.pulseCount++;
            this.metrics.lastPulseTime = duration;

            this.logger.debug('Event published successfully', { 
                duration,
                eventType: data.type,
                componentName: this.componentName
            });
            
            return true;
        } catch (error) {
            this.metrics.errorCount++;
            
            this.logger.error('Failed to publish event', { 
                error: error.message,
                stack: error.stack,
                eventData: data,
                componentName: this.componentName
            });
            
            throw error;
        }
    }

    async close() {
        try {
            await this.pulse({ type: 'shutdown' });
            await this.redis.quit();
            this.logger.info('DragonSensor shutdown complete', {
                componentName: this.componentName,
                nodeId: this.nodeId
            });
        } catch (error) {
            this.logger.error('Error during shutdown', { 
                error: error.message,
                stack: error.stack,
                componentName: this.componentName
            });
            throw error;
        }
    }

    async isHealthy() {
        return {
            status: this.redis.status === 'ready',
            metrics: this.metrics
        };
    }
}

export { DragonSensor };
