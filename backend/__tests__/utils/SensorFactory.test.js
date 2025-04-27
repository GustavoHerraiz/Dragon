import { SensorFactory, SENSOR_CHANNELS } from '../../utils/SensorFactory.js';
import { redis } from '../../config/redis.js';
import { logger } from '../../config/logger.js';
import { DragonError } from '../../utils/DragonError.js';

jest.mock('../../config/redis.js');
jest.mock('../../config/logger.js');

describe('SensorFactory', () => {
    let factory;

    beforeEach(() => {
        SensorFactory.instance = null;
        factory = SensorFactory.getInstance();
        redis.subscribe.mockClear();
        redis.publish.mockClear();
        logger.info.mockClear();
        logger.error.mockClear();
    });

    test('getInstance returns singleton instance', () => {
        const instance1 = SensorFactory.getInstance();
        const instance2 = SensorFactory.getInstance();
        expect(instance1).toBe(instance2);
    });

    test('initializeAll subscribes to all channels', async () => {
        await factory.initializeAll();
        expect(redis.subscribe).toHaveBeenCalledTimes(Object.keys(SENSOR_CHANNELS).length);
        Object.values(SENSOR_CHANNELS).forEach(channel => {
            expect(redis.subscribe).toHaveBeenCalledWith(channel);
        });
    });

    test('initializeAll handles redis errors', async () => {
        redis.subscribe.mockRejectedValueOnce(new Error('Redis error'));
        await expect(factory.initializeAll()).rejects.toThrow(DragonError);
        expect(logger.error).toHaveBeenCalled();
    });

    test('getSensor throws error for non-existent sensor', () => {
        expect(() => factory.getSensor('NON_EXISTENT'))
            .toThrow(DragonError);
        expect(logger.error).toHaveBeenCalled();
    });

    test('registerSensor registers new sensor', () => {
        const mockSensor = { id: 'test' };
        factory.registerSensor('TEST', mockSensor);
        expect(factory.getSensor('TEST')).toBe(mockSensor);
        expect(logger.info).toHaveBeenCalledWith(
            'Sensor registered',
            expect.objectContaining({
                component: 'SensorFactory',
                type: 'TEST'
            })
        );
    });

    test('emitPulse publishes to redis', () => {
        const mockSensor = { id: 'test' };
        factory.registerSensor('TEST', mockSensor);
        factory.emitPulse('TEST', 150);
        
        expect(redis.publish).toHaveBeenCalledWith(
            'dragon:pulse',
            expect.stringContaining('"comp":"TEST"')
        );
    });

    test('emitPulse handles errors', () => {
        const mockSensor = { id: 'test' };
        factory.registerSensor('TEST', mockSensor);
        redis.publish.mockRejectedValueOnce(new Error('Redis error'));
        
        expect(() => factory.emitPulse('TEST', 150))
            .toThrow(DragonError);
        expect(logger.error).toHaveBeenCalled();
    });
});
