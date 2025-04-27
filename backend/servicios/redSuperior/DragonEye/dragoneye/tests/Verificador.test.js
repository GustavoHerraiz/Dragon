/**
 * Tests Unitarios para Verificador
 * Proyecto Dragón - v1.0.0
 * @author GustavoHerraiz
 * @date 2025-04-16 10:24:30
 */

import { jest } from '@jest/globals';
import { VerificadorError, CODIGOS_ERROR } from '../core/errores.js';

// Mock de las métricas
const mockMetricas = {
    registrarTiempo: jest.fn().mockResolvedValue(undefined),
    incrementarContador: jest.fn().mockResolvedValue(undefined),
    establecerGauge: jest.fn().mockResolvedValue(undefined),
    obtenerMetricas: jest.fn().mockResolvedValue({})
};

// Mock del logger
const mockLogger = {
    info: jest.fn().mockResolvedValue(undefined),
    error: jest.fn().mockResolvedValue(undefined),
    warn: jest.fn().mockResolvedValue(undefined)
};

// Mocks de los módulos
jest.mock('../utils/metricas.js', () => ({
    __esModule: true,
    default: jest.fn(() => mockMetricas)
}));

jest.mock('../utils/logger.js', () => ({
    createDragonEyeLogger: jest.fn(() => mockLogger)
}));

import { Verificador } from '../core/Verificador.js';

describe('Verificador', () => {
    let verificador;

    beforeEach(() => {
        jest.clearAllMocks();
        Object.values(mockMetricas).forEach(mock => mock.mockClear());
        Object.values(mockLogger).forEach(mock => mock.mockClear());
        verificador = new Verificador(mockLogger, mockMetricas);
    });

    afterEach(() => {
        if (verificador?.intervalId) {
            clearInterval(verificador.intervalId);
        }
    });

    describe('Inicialización', () => {
        test('debe lanzar error si no se proporcionan las dependencias', () => {
            expect(() => new Verificador()).toThrow('Verificador requiere logger y métricas válidos');
            expect(() => new Verificador(null, mockMetricas)).toThrow('Verificador requiere logger y métricas válidos');
            expect(() => new Verificador(mockLogger, null)).toThrow('Verificador requiere logger y métricas válidos');
        });

        test('debe inicializarse con estado correcto', () => {
            expect(verificador.activo).toBe(false);
            expect(verificador.ultimaVerificacion).toBeNull();
            expect(verificador.verificacionesExitosas).toBe(0);
            expect(verificador.verificacionesFallidas).toBe(0);
        });
    });

    describe('Control del Sistema', () => {
        test('debe iniciar correctamente', async () => {
            await verificador.iniciar();
            expect(verificador.activo).toBe(true);
            expect(mockLogger.info).toHaveBeenCalledWith('Verificador: Sistema iniciado', expect.any(Object));
        });

        test('debe detener correctamente', async () => {
            await verificador.iniciar();
            await verificador.detener();
            expect(verificador.activo).toBe(false);
            expect(mockLogger.info).toHaveBeenCalledWith('Verificador: Sistema detenido correctamente');
        });

        test('debe manejar errores de inicio', async () => {
            const errorEsperado = new VerificadorError(
                CODIGOS_ERROR.INICIALIZACION,
                'Fallo en inicialización de métricas'
            );

            mockMetricas.establecerGauge.mockRejectedValueOnce(errorEsperado);

            try {
                await verificador.iniciar();
                fail('Se esperaba que iniciar() lanzara un error');
            } catch (error) {
                expect(error).toBeInstanceOf(VerificadorError);
                expect(error.codigo).toBe(CODIGOS_ERROR.INICIALIZACION);
                expect(mockLogger.error).toHaveBeenCalledWith(
                    'Verificador: Error fatal al iniciar',
                    expect.objectContaining({
                        codigo: CODIGOS_ERROR.INICIALIZACION,
                        mensaje: expect.any(String)
                    })
                );
            }
        });
    });

    describe('Verificación de Componentes', () => {
        test('debe verificar memoria correctamente', async () => {
            const resultado = await verificador.verificarMemoria();
            expect(resultado).toBe(true);
            expect(mockMetricas.establecerGauge).toHaveBeenCalledWith(
                'verificador_heap_usage',
                expect.any(Number)
            );
        });

        test('debe verificar rendimiento correctamente', async () => {
            const resultado = await verificador.verificarRendimiento();
            expect(resultado).toBe(true);
            expect(mockMetricas.registrarTiempo).toHaveBeenCalledWith(
                'verificador_performance_check',
                expect.any(Number)
            );
        });

        test('debe verificar conexiones correctamente', async () => {
            const resultado = await verificador.verificarConexiones();
            expect(resultado).toBe(true);
            expect(mockMetricas.establecerGauge).toHaveBeenCalledWith(
                'verificador_active_connections',
                expect.any(Number)
            );
        });
    });

    describe('Manejo de Errores', () => {
        test('debe manejar errores de verificación', async () => {
            const error = new VerificadorError(
                CODIGOS_ERROR.VERIFICACION,
                'Error en proceso de verificación'
            );
            
            await verificador.manejarErrorVerificacion(error);
            
            expect(mockMetricas.incrementarContador).toHaveBeenCalledWith('verificador_errors');
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Verificador: Error recuperable',
                expect.objectContaining({
                    codigo: CODIGOS_ERROR.VERIFICACION,
                    mensaje: expect.any(String)
                })
            );
            expect(verificador.verificacionesFallidas).toBe(1);
        });

        test('debe escalar errores después de máximos intentos', async () => {
            const error = new VerificadorError(
                CODIGOS_ERROR.PERSISTENTE,
                'Error persistente en verificación'
            );
            
            for (let i = 0; i <= verificador.maxIntentosReconexion; i++) {
                await verificador.manejarErrorVerificacion(error);
            }
            
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Verificador: Error crítico - máximo de intentos alcanzado',
                expect.objectContaining({
                    codigo: CODIGOS_ERROR.PERSISTENTE,
                    mensaje: expect.any(String)
                })
            );
        });
    });

    describe('Métricas y Performance', () => {
        test('debe calcular tasa de éxito correctamente', () => {
            verificador.verificacionesExitosas = 95;
            verificador.verificacionesFallidas = 5;
            expect(verificador.calcularTasaExito()).toBe(0.95);
        });

        test('debe registrar tiempos de verificación', async () => {
            await verificador.verificar();
            expect(mockMetricas.registrarTiempo).toHaveBeenCalledWith(
                'verificador_check_time',
                expect.any(Number)
            );
        });

        test('debe alertar cuando la verificación excede el tiempo límite', async () => {
            const now = Date.now();
            jest.spyOn(Date, 'now')
                .mockReturnValueOnce(now)
                .mockReturnValueOnce(now + 250);

            await verificador.verificar();
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Verificador: Verificación excedió P95',
                expect.objectContaining({
                    tiempoEjecucion: expect.any(Number),
                    limiteP95: 200
                })
            );
        });
    });

    describe('Estado del Sistema', () => {
        test('debe retornar estado completo', async () => {
            await verificador.iniciar();
            const estado = verificador.obtenerEstado();
            
            expect(estado).toEqual({
                activo: true,
                ultimaVerificacion: expect.any(String),
                verificacionesExitosas: expect.any(Number),
                verificacionesFallidas: expect.any(Number),
                tasaExito: expect.any(Number),
                intentosReconexion: expect.any(Number)
            });
        });

        test('debe actualizar estado después de verificación', async () => {
            const estadoInicial = verificador.obtenerEstado();
            await verificador.verificar();
            const estadoFinal = verificador.obtenerEstado();
            
            expect(estadoFinal.ultimaVerificacion).not.toBe(estadoInicial.ultimaVerificacion);
            expect(estadoFinal.verificacionesExitosas).toBeGreaterThan(estadoInicial.verificacionesExitosas);
        });
    });
});
