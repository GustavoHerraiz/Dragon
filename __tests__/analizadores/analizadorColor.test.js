const path = require('path');

// Mock del logger para tests
const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
};

// Mock de winston
jest.mock('../../backend/servicios/redSuperior/utils/logger.js', () => ({
    logger: mockLogger
}));

const analizadorColorPath = '../../backend/servicios/analizadores/analizadorColor.js';
const analizadorColor = require(analizadorColorPath);

const RUTA_IMAGEN_PRUEBA = path.join(__dirname, '../fixtures/imagen-prueba.jpg');

describe('AnalizadorColor - Test Seguro', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('debe mantener funcionalidad básica', async () => {
        const resultado = await analizadorColor.analizar(RUTA_IMAGEN_PRUEBA);
        
        // Verificaciones básicas
        expect(resultado).toBeDefined();
        expect(resultado).toHaveProperty('nombreAnalizador');
        expect(resultado).toHaveProperty('score');
        expect(resultado).toHaveProperty('detalles');
        
        // Verificar que se usó el logger
        expect(mockLogger.info).toHaveBeenCalled();
    });

    test('debe manejar errores correctamente', async () => {
        const resultado = await analizadorColor.analizar('archivo_no_existente.jpg');
        
        expect(resultado.score).toBe(null);
        expect(resultado.detalles.mensaje).toContain('Error');
        expect(mockLogger.error).toHaveBeenCalled();
    });
});
