/**
 * Tests para el Monitor de DragonEye
 * Proyecto Dragon - Red Superior
 * @author GustavoHerraiz
 * @date 2025-04-16
 */

import { jest } from '@jest/globals';
import { Monitor } from '../core/Monitor.js';
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

describe('Monitor', () => {
    let monitor;

    beforeEach(() => {
        jest.clearAllMocks();
        monitor = new Monitor(mockLogger, mockMetricas);
    });

    describe('Inicialización', () => {
        test('debe inicializarse con valores por defecto', () => {
            expect(monitor.activo).toBe(false);
            expect(monitor.eventos).toEqual([]);
            expect(monitor.ultimoEvento).toBeNull();
        });

        test('debe lanzar error si faltan dependencias', () => {
            expect(() => new Monitor()).toThrow(DragonEyeError);
            expect(() => new Monitor(mockLogger)).toThrow(DragonEyeError);
        });
    });

    describe('Control del Servicio', () => {
        test('debe iniciar correctamente', async () => {
            await monitor.iniciar();
            expect(monitor.activo).toBe(true);
            expect(mockLogger.info).toHaveBeenCalledWith(
                'Monitor: Servicio iniciado correctamente',
                expect.any(Object)
            );
        });

        test('debe detener correctamente', async () => {
            await monitor.iniciar();
            await monitor.detener();
            expect(monitor.activo).toBe(false);
            expect(mockLogger.info).toHaveBeenCalledWith(
                'Monitor: Servicio detenido correctamente',
                expect.any(Object)
            );
        });
    });

    describe('Registro de Eventos', () => {
        beforeEach(async () => {
            await monitor.iniciar();
        });

        test('debe registrar evento crítico', async () => {
            const evento = {
                tipo: 'ERROR_CRITICO',
                detalles: { error: 'Test error' }
            };

            await monitor.registrarEvento(evento.tipo, evento.detalles);

            expect(monitor.eventos).toHaveLength(1);
            expect(monitor.ultimoEvento).toEqual(expect.objectContaining({
                tipo: evento.tipo,
                detalles: evento.detalles,
                timestamp: expect.any(String)
            }));
            expect(mockMetricas.incrementarContador).toHaveBeenCalledWith(
                'dragoneye_eventos_criticos'
            );
        });

        test('debe mantener historial de eventos limitado', async () => {
            const MAX_EVENTOS = 100;
            for (let i = 0; i < MAX_EVENTOS + 10; i++) {
                await monitor.registrarEvento('TEST_EVENT', { index: i });
            }
            expect(monitor.eventos).toHaveLength(MAX_EVENTOS);
            expect(monitor.eventos[0].detalles.index).toBe(10); // Primero más antiguo
        });

        test('debe validar tipo de evento', async () => {
            await expect(
                monitor.registrarEvento('TIPO_INVALIDO')
            ).rejects.toThrow(DragonEyeError);
        });
    });

    describe('Análisis de Eventos', () => {
        beforeEach(async () => {
            await monitor.iniciar();
        });

        test('debe detectar patrones de error', async () => {
            for (let i = 0; i < 5; i++) {
                await monitor.registrarEvento('ERROR_PROCESAMIENTO', {
                    codigo: CODIGOS_ERROR.TIMEOUT
                });
            }

            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Monitor: Detectado patrón de errores',
                expect.objectContaining({
                    tipo: 'ERROR_PROCESAMIENTO',
                    ocurrencias: 5
                })
            );
        });

        test('debe generar resumen de estado', () => {
            const estado = monitor.obtenerEstado();
            expect(estado).toEqual(expect.objectContaining({
                activo: true,
                totalEventos: expect.any(Number),
                ultimoEvento: expect.any(Object),
                patrones: expect.any(Array)
            }));
        });
    });

    describe('Gestión de Recursos', () => {
        beforeEach(async () => {
            await monitor.iniciar();
        });

        test('debe liberar recursos al detener', async () => {
            await monitor.registrarEvento('TEST_EVENT', { data: 'test' });
            await monitor.detener();
            
            expect(monitor.eventos).toEqual([]);
            expect(monitor.ultimoEvento).toBeNull();
        });

        test('debe persistir eventos críticos', async () => {
            const eventoCritico = {
                tipo: 'ERROR_CRITICO',
                detalles: { error: 'Error grave' }
            };

            await monitor.registrarEvento(eventoCritico.tipo, eventoCritico.detalles);
            await monitor.detener();
            await monitor.iniciar();

            expect(monitor.eventos).toContainEqual(
                expect.objectContaining({
                    tipo: eventoCritico.tipo,
                    detalles: eventoCritico.detalles
                })
            );
        });
    });
});
