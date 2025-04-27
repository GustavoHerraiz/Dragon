import rightHandColorSensor from '../../../servicios/sensores/rightHandColorSensor.js';
import { redis } from '../../../config/redis.js';
import { logger } from '../../../config/logger.js';
import { DragonError } from '../../../utils/DragonError.js';

jest.mock('../../../config/redis.js');
jest.mock('../../../config/logger.js');

describe('RightHandColorSensor', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('initializes with correct default values', () => {
        expect(rightHandColorSensor.getSensitivity()).toBe(1.0);
        expect(rightHandColorSensor.getChannel()).toBe('dragon:input:analyzer1_hand_right_color');
    });

    test('processes valid input correctly', () => {
        const validMessage = JSON.stringify({ value: 0.5 });
        redis.emit('message', rightHandColorSensor.getChannel(), validMessage);
        
        expect(rightHandColorSensor.getSensitivity()).toBe(0.5);
        expect(logger.debug).toHaveBeenCalledWith(
            'Pulse emitted',
            expect.any(Object)
        );
    });

    test('rejects invalid input values', () => {
        const invalidMessage = JSON.stringify({ value: 1.5 });
        
        expect(() => {
            redis.emit('message', rightHandColorSensor.getChannel(), invalidMessage);
        }).toThrow(DragonError);

        expect(logger.error).toHaveBeenCalled();
    });

    test('handles malformed JSON', () => {
        const invalidJson = 'invalid json';
        
        expect(() => {
            redis.emit('message', rightHandColorSensor.getChannel(), invalidJson);
        }).toThrow(DragonError);

        expect(logger.error).toHaveBeenCalled();
    });

    test('ignores messages from wrong channel', () => {
        const message = JSON.stringify({ value: 0.5 });
        redis.emit('message', 'wrong:channel', message);
        
        expect(rightHandColorSensor.getSensitivity()).toBe(1.0); // mantiene valor original
        expect(logger.debug).not.toHaveBeenCalled();
    });

    test('logs warning when exceeding P95 threshold', () => {
        jest.useFakeTimers();
        const message = JSON.stringify({ value: 0.5 });
        
        // Simulamos procesamiento lento
        jest.advanceTimersByTime(201); // > 200ms
        redis.emit('message', rightHandColorSensor.getChannel(), message);

        expect(logger.warn).toHaveBeenCalledWith(
            'P95 threshold exceeded',
            expect.any(Object)
        );
    });
});
