import { jest } from '@jest/globals';
import { DragonEye } from '../lib/DragonEye.js';

describe('DragonEye', () => {
    let eye;

    beforeEach(() => {
        eye = new DragonEye();
    });

    afterEach(async () => {
        await eye.close();
    });

    test('should handle incoming events', () => {
        const testEvent = {
            nodeId: 'test-123',
            componentName: 'test-component',
            type: 'test-event',
            timestamp: new Date().toISOString()
        };

        eye.handleSensorEvent(testEvent);
        
        const sensors = eye.getSensorsStatus();
        expect(sensors).toHaveLength(1);
        expect(sensors[0].nodeId).toBe('test-123');
        expect(sensors[0].componentName).toBe('test-component');
    });

    test('should remove inactive sensors', () => {
        const testEvent = {
            nodeId: 'test-123',
            componentName: 'test-component',
            type: 'shutdown',
            timestamp: new Date().toISOString()
        };

        eye.handleSensorEvent(testEvent);
        
        const sensors = eye.getSensorsStatus();
        expect(sensors).toHaveLength(0);
    });

    test('should emit events', (done) => {
        const testEvent = {
            nodeId: 'test-123',
            componentName: 'test-component',
            type: 'test-event',
            timestamp: new Date().toISOString()
        };

        eye.on('event', (data) => {
            expect(data).toEqual(testEvent);
            done();
        });

        eye.handleSensorEvent(testEvent);
    });

    test('should track performance metrics', async () => {
        const testEvent = {
            nodeId: 'test-123',
            componentName: 'test-component',
            type: 'test-event',
            timestamp: new Date().toISOString()
        };

        await eye.handleSensorEvent(testEvent);
        const health = await eye.isHealthy();
        
        expect(health.metrics).toBeDefined();
        expect(health.metrics.eventsProcessed).toBe(1);
        expect(health.metrics.lastProcessingTime).toBeDefined();
    });
});
