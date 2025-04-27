import { jest } from '@jest/globals';
import { DragonSensor } from '../lib/DragonSensor.js';

describe('DragonSensor', () => {
    let sensor;

    beforeEach(() => {
        sensor = new DragonSensor('test-component');
    });

    afterEach(async () => {
        await sensor.close();
    });

    test('should create sensor with component name', () => {
        expect(sensor.componentName).toBe('test-component');
        expect(sensor.nodeId).toBeDefined();
    });

    test('should throw error if no component name provided', () => {
        expect(() => new DragonSensor()).toThrow('DragonSensor requires a componentName');
    });

    test('should publish events successfully', async () => {
        const result = await sensor.pulse({ type: 'test-event' });
        expect(result).toBe(true);
    });

    test('should include required fields in published event', async () => {
        const mockPublish = jest.spyOn(sensor.redis, 'publish');
        await sensor.pulse({ type: 'test-event' });
        
        expect(mockPublish).toHaveBeenCalled();
        const publishedData = JSON.parse(mockPublish.mock.calls[0][1]);
        
        expect(publishedData).toHaveProperty('nodeId');
        expect(publishedData).toHaveProperty('componentName');
        expect(publishedData).toHaveProperty('timestamp');
        expect(publishedData).toHaveProperty('type');
    });

    test('should handle Redis connection errors', async () => {
        sensor.redis.disconnect();
        await expect(sensor.pulse({ type: 'test' }))
            .rejects.toThrow('Redis not connected');
    });

    test('should track performance metrics', async () => {
        await sensor.pulse({ type: 'test-event' });
        const health = await sensor.isHealthy();
        
        expect(health.metrics).toBeDefined();
        expect(health.metrics.pulseCount).toBe(1);
        expect(health.metrics.lastPulseTime).toBeDefined();
    });
});
