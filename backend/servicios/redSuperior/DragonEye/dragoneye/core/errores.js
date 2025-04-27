/**
 * Definición de errores personalizados para el sistema DragonEye
 * Proyecto Dragon - Red Superior
 * @author GustavoHerraiz
 * @date 2025-04-16
 */

// Clase base para errores del sistema DragonEye
export class DragonEyeError extends Error {
    constructor(codigo, mensaje, detalles = {}) {
        super(mensaje);
        this.name = 'DragonEyeError';
        this.codigo = codigo;
        this.detalles = detalles;
        this.timestamp = new Date().toISOString();
    }

    toJSON() {
        return {
            name: this.name,
            codigo: this.codigo,
            mensaje: this.message,
            detalles: this.detalles,
            timestamp: this.timestamp
        };
    }
}

// Mantenemos la clase VerificadorError existente, ahora heredando de DragonEyeError
export class VerificadorError extends DragonEyeError {
    constructor(codigo, mensaje, detalles = {}) {
        super(codigo, mensaje, detalles);
        this.name = 'VerificadorError';
    }
}

// Códigos de error existentes del Verificador
export const CODIGOS_ERROR = {
    // Mantenemos los códigos existentes del Verificador
    INICIALIZACION: 'ERR_INICIALIZACION',
    VERIFICACION: 'ERR_VERIFICACION',
    METRICAS: 'ERR_METRICAS',
    MEMORIA: 'ERR_MEMORIA',
    CONEXION: 'ERR_CONEXION',
    RENDIMIENTO: 'ERR_RENDIMIENTO',
    TIMEOUT: 'ERR_TIMEOUT',
    MAX_INTENTOS: 'ERR_MAX_INTENTOS',
    
    // Añadimos los nuevos códigos para DragonEye
    ERROR_PROCESAMIENTO: 'ERR_DRAGONEYE_PROC',
    ERROR_CRITICO: 'ERR_DRAGONEYE_CRIT',
    ERROR_PERSISTENTE: 'ERR_DRAGONEYE_PERS',
    FORMATO_INVALIDO: 'ERR_DRAGONEYE_FMT'
};

// Mantenemos los mensajes existentes y añadimos los nuevos
export const MENSAJES_ERROR = {
    // Mensajes existentes del Verificador
    [CODIGOS_ERROR.INICIALIZACION]: 'Error durante la inicialización del verificador',
    [CODIGOS_ERROR.VERIFICACION]: 'Error en proceso de verificación',
    [CODIGOS_ERROR.METRICAS]: 'Error al registrar métricas',
    [CODIGOS_ERROR.MEMORIA]: 'Error en verificación de memoria',
    [CODIGOS_ERROR.CONEXION]: 'Error en verificación de conexiones',
    [CODIGOS_ERROR.RENDIMIENTO]: 'Error en verificación de rendimiento',
    [CODIGOS_ERROR.TIMEOUT]: 'Tiempo de espera excedido',
    [CODIGOS_ERROR.MAX_INTENTOS]: 'Máximo número de intentos alcanzado',
    
    // Nuevos mensajes para DragonEye
    [CODIGOS_ERROR.ERROR_PROCESAMIENTO]: 'Error durante el procesamiento de imagen',
    [CODIGOS_ERROR.ERROR_CRITICO]: 'Error crítico en el sistema DragonEye',
    [CODIGOS_ERROR.ERROR_PERSISTENTE]: 'Error persistente en el sistema DragonEye',
    [CODIGOS_ERROR.FORMATO_INVALIDO]: 'Formato de imagen no válido'
};

// Mantenemos la función crearError existente
export function crearError(codigo, mensajePersonalizado, detalles = {}) {
    const mensaje = mensajePersonalizado || MENSAJES_ERROR[codigo] || 'Error desconocido en el sistema';
    return new DragonEyeError(codigo, mensaje, detalles);
}
