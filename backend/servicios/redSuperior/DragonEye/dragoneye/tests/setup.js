/**
 * Configuración de Tests para DragonEye
 * Proyecto Dragón - v1.0.0
 * @author GustavoHerraiz
 * @date 2025-04-16 09:25:50
 */

import { jest } from '@jest/globals';

// Configuración del entorno de pruebas
process.env.NODE_ENV = 'test';

// Configuración de timeouts para pruebas asíncronas
jest.setTimeout(10000);

// Mock del sistema de archivos para logs
jest.mock('fs', () => ({
    existsSync: jest.fn().mockReturnValue(true),
    mkdirSync: jest.fn(),
    writeFileSync: jest.fn()
}));

// Configuración de temporizadores falsos
jest.useFakeTimers();

// Limpieza global después de cada prueba
afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
});
