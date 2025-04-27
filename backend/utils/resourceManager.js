import winston from 'winston';

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
            return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
        })
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: './logs/resources.log' })
    ]
});

class ResourceManager {
    static #instance = null;
    #metrics = new Map();

    static getInstance() {
        if (!ResourceManager.#instance) {
            ResourceManager.#instance = new ResourceManager();
        }
        return ResourceManager.#instance;
    }

    startMetrics() {
        setInterval(() => {
            const used = process.memoryUsage();
            const metrics = {
                memory: {
                    rss: `${Math.round(used.rss / 1024 / 1024)}MB`,
                    heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)}MB`,
                    heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)}MB`,
                    external: `${Math.round(used.external / 1024 / 1024)}MB`,
                },
                cpu: process.cpuUsage()
            };

            if (used.heapUsed / used.heapTotal > 0.9) {
                logger.warn('⚠️ High memory usage detected', metrics);
            }

            this.#metrics.set(Date.now(), metrics);
            // Keep only last hour of metrics
            const hourAgo = Date.now() - 3600000;
            for (let [timestamp] of this.#metrics) {
                if (timestamp < hourAgo) this.#metrics.delete(timestamp);
            }
        }, 60000);

        logger.info('🔄 Resource monitoring started');
    }

    getMetrics() {
        return Array.from(this.#metrics.entries())
            .sort((a, b) => b[0] - a[0])
            .slice(0, 60);
    }
}

export default ResourceManager;
