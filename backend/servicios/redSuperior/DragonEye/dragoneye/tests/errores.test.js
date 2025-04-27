/**
 * Tests para el sistema de errores de DragonEye
 * Proyecto Dragon - Red Superior
 * @author GustavoHerraiz
 * @date 2025-04-16
 */

import { jest } from '@jest/globals';
import { 
    DragonEyeError,
    VerificadorError, 
    CODIGOS_ERROR,
    MENSAJES_ERROR,
    crearError 
} from '../core/errores.js';

describe('Sistema de Errores DragonEye', () => {
    describe('Creación de Errores', () => {
        test('debe crear DragonEyeError con propiedades correctas', () => {
            const error = new DragonEyeError(
                CODIGOS_ERROR.ERROR_CRITICO,
                'Mensaje de prueba',
                { detalle: 'test' }
            );

            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(DragonEyeError);
            expect(error.name).toBe('DragonEyeError');
            expect(error.codigo).toBe(CODIGOS_ERROR.ERROR_CRITICO);
            expect(error.message).toBe('Mensaje de prueba');
            expect(error.detalles).toEqual({ detalle: 'test' });
            expect(error.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        });

        test('debe crear VerificadorError con herencia correcta', () => {
            const error = new VerificadorError(
                CODIGOS_ERROR.VERIFICACION,
                'Error de verificación'
            );

            expect(error).toBeInstanceOf(DragonEyeError);
            expect(error).toBeInstanceOf(VerificadorError);
            expect(error.name).toBe('VerificadorError');
        });

        test('función crearError debe generar error con mensaje predeterminado', () => {
            const error = crearError(CODIGOS_ERROR.TIMEOUT);
            
            expect(error).toBeInstanceOf(DragonEyeError);
            expect(error.message).toBe(MENSAJES_ERROR[CODIGOS_ERROR.TIMEOUT]);
        });

        test('función crearError debe permitir mensaje personalizado', () => {
            const mensajePersonalizado = 'Error personalizado';
            const error = crearError(CODIGOS_ERROR.TIMEOUT, mensajePersonalizado);
            
            expect(error.message).toBe(mensajePersonalizado);
        });
    });

    describe('Serialización JSON', () => {
        test('debe serializar correctamente a JSON', () => {
            const detalles = { valor: 42 };
            const error = new DragonEyeError(
                CODIGOS_ERROR.ERROR_CRITICO,
                'Error crítico',
                detalles
            );

            const json = error.toJSON();

            expect(json).toEqual({
                name: 'DragonEyeError',
                codigo: CODIGOS_ERROR.ERROR_CRITICO,
                mensaje: 'Error crítico',
                detalles: detalles,
                timestamp: expect.any(String)
            });
        });
    });

    describe('Códigos de Error', () => {
        test('todos los códigos deben tener mensaje asociado', () => {
            Object.values(CODIGOS_ERROR).forEach(codigo => {
                expect(MENSAJES_ERROR[codigo]).toBeDefined();
                expect(typeof MENSAJES_ERROR[codigo]).toBe('string');
            });
        });

        test('debe mantener consistencia en formato de códigos', () => {
            const codigoRegex = /^ERR_[A-Z_]+$/;
            Object.values(CODIGOS_ERROR).forEach(codigo => {
                expect(codigo).toMatch(codigoRegex);
            });
        });
    });

    describe('Manejo de Casos Extremos', () => {
        test('debe manejar detalles undefined', () => {
            const error = new DragonEyeError(CODIGOS_ERROR.METRICAS, 'Test');
            expect(error.detalles).toEqual({});
        });

        test('debe manejar código desconocido', () => {
            const error = crearError('CODIGO_INEXISTENTE');
            expect(error.message).toBe('Error desconocido en el sistema');
        });
    });
});
