/**
 * Tests para DragonEye
 * Proyecto Dragon - Red Superior
 * @author GustavoHerraiz
 * @date 2025-04-16
 */

import { jest } from '@jest/globals';
import { DragonEye } from '../core/DragonEye.js';
import { DragonEyeError, CODIGOS_ERROR } from '../core/errores.js';

const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
};

const mockMetricas = {
    incrementarContador: jest.fn(),
    establecerGauge: jest.fn(),
    registrarHistograma: jest.fn()
};

const mockVerificador = {
    iniciar: jest.fn().mockResolvedValue(undefined),
    detener: jest.fn().mockResolvedValue(undefined),
    verificarNodos: jest.fn().mockResolvedValue({ estado: 'OK' }),
    obtenerEstado: jest.fn().mockReturnValue({ estado: 'OK' })
};

const mockMonitor = {
    iniciar: jest.fn().mockResolvedValue(undefined),
    detener: jest.fn().mockResolvedValue(undefined),
    registrarEvento: jest.fn().mockResolvedValue(undefined),
    obtenerEstado: jest.fn().mockReturnValue({ totalEventos: 0 })
};

describe('DragonEye', () => {
    let dragonEye;

    beforeEach(async () => {
        jest.clearAllMocks();
        dragonEye = new DragonEye(mockLogger, mockMetricas, mockVerificador, mockMonitor);
        await dragonEye.iniciar();  // Iniciamos DragonEye en cada test
    });

    afterEach(async () => {
        if (dragonEye.activo) {
            await dragonEye.detener();
        }
    });

    describe('Inicialización', () => {
        test('debe crear instancia correctamente', () => {
            const newDragonEye = new DragonEye(mockLogger, mockMetricas, mockVerificador, mockMonitor);
            expect(newDragonEye).toBeInstanceOf(DragonEye);
            expect(newDragonEye.activo).toBe(false);
        });

        test('debe requerir todas las dependencias', () => {
            expect(() => new DragonEye(null, mockMetricas, mockVerificador, mockMonitor))
                .toThrow(DragonEyeError);
        });

        test('debe iniciar correctamente', () => {
            expect(dragonEye.activo).toBe(true);
            expect(mockLogger.info).toHaveBeenCalledWith(
                'DragonEye: Servicio iniciado correctamente'
            );
        });
    });

    describe('Operaciones', () => {
        test('debe verificar nodos correctamente', async () => {
            const nodos = [{ id: 1 }, { id: 2 }];
            const resultado = await dragonEye.verificarNodos(nodos);
            expect(resultado).toBeDefined();
            expect(mockMetricas.registrarHistograma).toHaveBeenCalled();
        });

        test('debe registrar eventos de verificación', async () => {
            const nodos = [{ id: 1 }];
            await dragonEye.verificarNodos(nodos);
            expect(mockMonitor.registrarEvento).toHaveBeenCalledWith(
                'VERIFICACION_COMPLETADA',
                expect.any(Object)
            );
        });

        test('no debe permitir verificación si está inactivo', async () => {
            await dragonEye.detener();
            await expect(dragonEye.verificarNodos([]))
                .rejects.toThrow(DragonEyeError);
        });
    });

    describe('Monitoreo', () => {
        test('debe registrar eventos del sistema', async () => {
            await dragonEye.verificarNodos([{ id: 1 }]);
            expect(mockMonitor.registrarEvento).toHaveBeenCalledWith(
                'VERIFICACION_COMPLETADA',
                expect.any(Object)
            );
        });

        test('debe mantener estado coherente', () => {
            const estado = dragonEye.obtenerEstado();
            expect(estado).toEqual({
                activo: true,
                verificador: expect.any(Object),
                monitor: expect.any(Object)
            });
        });
    });

    describe('Gestión de Errores', () => {
        beforeEach(() => {
            // Limpiamos las llamadas previas a registrarEvento
            mockMonitor.registrarEvento.mockClear();
        });

        test('debe manejar errores de verificación', async () => {
            const error = new Error('Error simulado');
            mockVerificador.verificarNodos.mockRejectedValueOnce(error);
            
            await expect(dragonEye.verificarNodos([{ id: 1 }]))
                .rejects.toThrow();
            
            // Verificamos que se registró el evento de error
            expect(mockMonitor.registrarEvento)
                .toHaveBeenCalledWith('ERROR_VERIFICACION', expect.any(Object));
        });

        test('debe detener servicios en caso de error crítico', async () => {
            const error = new DragonEyeError(CODIGOS_ERROR.ERROR_CRITICO, 'Error grave');
            mockVerificador.verificarNodos.mockRejectedValueOnce(error);
            
            await expect(dragonEye.verificarNodos([{ id: 1 }]))
                .rejects.toThrow(DragonEyeError);

            // Verificamos que se registró el evento de error
            expect(mockMonitor.registrarEvento)
                .toHaveBeenCalledWith('ERROR_VERIFICACION', expect.any(Object));
        });
    });
});
