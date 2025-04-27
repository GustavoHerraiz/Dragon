import { DragonError } from '../../utils/DragonError.js';
import { logger } from '../../config/logger.js';

jest.mock('../../config/logger.js');

describe('DragonError', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('creates error with code and message', () => {
        const error = new DragonError('SENSOR_INIT_ERROR');
        expect(error.code).toBe('SENSOR_INIT_ERROR');
        expect(error.message).toBe('Failed to initialize sensor');
    });

    test('includes timestamp and metadata', () => {
        const originalError = new Error('Original error');
        const metadata = { sensorId: 'sensor1' };
        const error = new DragonError('SENSOR_INIT_ERROR', originalError, metadata);

        expect(error.timestamp).toBeDefined();
        expect(error.metadata.sensorId).toBe('sensor1');
        expect(error.metadata.originalError.message).toBe('Original error');
    });

    test('logs error on creation', () => {
        const error = new DragonError('SENSOR_INIT_ERROR');
        expect(logger.error).toHaveBeenCalled();
    });

    test('identifies critical errors', () => {
        const criticalError = new DragonError('REDIS_CONNECTION_ERROR');
        const nonCriticalError = new DragonError('SENSOR_NOT_FOUND');

        expect(criticalError.isCritical()).toBe(true);
        expect(nonCriticalError.isCritical()).toBe(false);
    });

    test('logs critical errors with alert flag', () => {
        const criticalError = new DragonError('REDIS_CONNECTION_ERROR');
        
        expect(logger.error).toHaveBeenCalledWith(
            'CRITICAL: Dragon system error',
            expect.objectContaining({
                alert: true
            })
        );
    });

    test('serializes to JSON correctly', () => {
        const error = new DragonError('SENSOR_INIT_ERROR');
        const json = error.toJSON();

        expect(json).toEqual(expect.objectContaining({
            name: 'DragonError',
            code: 'SENSOR_INIT_ERROR',
            message: 'Failed to initialize sensor'
        }));
    });

    test('uses default message for unknown error codes', () => {
        const error = new DragonError('UNKNOWN_CODE');
        expect(error.message).toBe('An unexpected error occurred');
    });
});
