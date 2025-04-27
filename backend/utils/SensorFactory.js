import redis from '../config/redis.js';
import winston from 'winston';
import analizadorImagenSensor from './sensores/analizadorImagenSensor.js';
import SENSOR_CHANNELS from './SensorChannels.js'; // Importación correcta de SENSOR_CHANNELS

// Configuración de Winston para logging
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.printf(({ level, message }) =>
        `[${new Date().toISOString()}] ${level.toUpperCase()}: ${message}`
    ),
    transports: [new winston.transports.Console()]
});

class SensorFactory {
    static #instance = null;
    #cache = new Map();
    #availableSensors = new Map();

    constructor() {
        // Registrar sensores disponibles con validación
        if (analizadorImagenSensor && typeof analizadorImagenSensor.initialize === 'function') {
            this.#availableSensors.set('analizadorImagen', analizadorImagenSensor);
        } else {
            logger.warn('analizadorImagenSensor no tiene un método initialize o está mal definido.');
        }
    }

    // Método para obtener instancia única de la fábrica
    static getInstance() {
        if (!this.#instance) {
            this.#instance = new SensorFactory();
        }
        return this.#instance;
    }

    // Inicializar todos los sensores registrados
    async initializeAll() {
        try {
            logger.info('Initializing sensor factory...');
            const start = Date.now();

            // Validar conexión con Redis
            await redis.ping();
            const end = Date.now();
            logger.info(`Redis connection validated in ${end - start}ms`);

            // Inicializar cada sensor registrado
            for (const [name, sensor] of this.#availableSensors.entries()) {
                try {
                    if (sensor.initialize) {
                        // Pasar la instancia de SensorFactory a cada sensor
                        await sensor.initialize(this);
                        logger.info(`Sensor "${name}" initialized successfully`);
                    } else {
                        logger.warn(`Sensor "${name}" has no initialize method`);
                    }
                } catch (sensorError) {
                    logger.error(`Error al inicializar el sensor "${name}": ${sensorError.message}`, {
                        stack: sensorError.stack
                    });
                }
            }

            return true;
        } catch (error) {
            logger.error('Initialization error in SensorFactory: ' + error.message, { stack: error.stack });
            throw error; // Solo si Redis falla
        }
    }

    // Establecer datos del sensor en caché y Redis
    async setSensorData(key, data, expiration = 300) {
        try {
            this.#cache.set(key, data);
            await redis.set(`sensor:${key}`, JSON.stringify(data), 'EX', expiration);
            logger.info(`Sensor data for key "${key}" stored in Redis`);
        } catch (error) {
            logger.warn(`?? Redis error while setting key "${key}": ${error.message}`);
            logger.info(`Data for key "${key}" is still cached in memory.`);
        }
    }

    // Obtener datos del sensor desde caché o Redis
    async getSensorData(key) {
        // Intentar primero desde el caché en memoria
        if (this.#cache.has(key)) {
            logger.info(`Cache hit for key "${key}"`);
            return this.#cache.get(key);
        }

        try {
            const start = process.hrtime();
            const data = await redis.get(`sensor:${key}`);
            const [seconds, nanoseconds] = process.hrtime(start);
            const elapsedMs = (seconds * 1000 + nanoseconds / 1e6).toFixed(2);

            if (data) {
                logger.info(`Redis hit for key "${key}" in ${elapsedMs}ms`);
                const parsedData = JSON.parse(data);
                this.#cache.set(key, parsedData); // Actualizar caché en memoria
                return parsedData;
            } else {
                logger.info(`Redis miss for key "${key}"`);
                return null;
            }
        } catch (error) {
            logger.error(`Redis error while fetching key "${key}": ${error.message}`);
            return null;
        }
    }

    // Obtener un sensor registrado por su nombre
    getSensor(name) {
        if (this.#availableSensors.has(name)) {
            return this.#availableSensors.get(name);
        } else {
            logger.warn(`Sensor with name "${name}" not found`);
            return null;
        }
    }

    // Registrar un sensor manualmente
    registerSensor(type, sensor) {
        if (!type || !sensor) {
            throw new Error('El tipo de sensor y la instancia del sensor son obligatorios para registrarlo.');
        }

        this.#availableSensors.set(type, sensor);
        logger.info(`Sensor "${type}" registrado en SensorFactory.`);
    }
}

// Exportar como instancia única
const sensorFactoryInstance = SensorFactory.getInstance();
export { SensorFactory, sensorFactoryInstance };
export default SensorFactory;