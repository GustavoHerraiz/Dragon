/**
 * @fileoverview Wrapper para analizadores de Dragón
 * @author GustavoHerraiz
 * @date 2025-04-15
 */

const logger = require('./utils/logger');
const { medirTiempo, medirRecursos } = require('./utils/metricas');

/**
 * Wrapper para los analizadores existentes que permite ejecutar
 * la versión en producción mientras recolecta datos para la red superior
 */
class WrapperAnalizador {
    constructor() {
        this.modoTest = process.env.ENABLE_V2_TESTING === 'true';
    }

    /**
     * Envuelve la ejecución de un analizador
     * @param {Object} analizador - Instancia del analizador
     * @param {string} rutaArchivo - Ruta del archivo a analizar
     * @returns {Promise<Object>} - Resultado del análisis
     */
    async analizar(analizador, rutaArchivo) {
        let resultadoOriginal;
        let metricas;

        try {
            // 1. Ejecutar versión producción y medir
            const inicio = process.hrtime();
            resultadoOriginal = await this.ejecutarConRetry(
                () => analizador.analizar(rutaArchivo),
                analizador.nombre
            );
            metricas = medirTiempo(inicio);

            // Registrar métricas del análisis original
            logger.metricas({
                tipo: 'analisis_original',
                analizador: analizador.nombre,
                tiempo: metricas.tiempoTotal
            });

        } catch (error) {
            logger.error(`Error crítico en análisis original ${analizador.nombre}:`, error);
            // En caso de error crítico, devolver un resultado neutro
            return this.generarResultadoNeutro(analizador.nombre);
        }

        // 2. Si está en modo testing, ejecutar nueva versión
        if (this.modoTest) {
            try {
                const resultadoMejorado = await this.ejecutarVersionMejorada(
                    analizador,
                    rutaArchivo,
                    resultadoOriginal
                );
                
                await this.guardarDatosRedSuperior({
                    analizador: analizador.nombre,
                    resultadoOriginal,
                    resultadoMejorado,
                    metricas
                });
            } catch (error) {
                logger.error(`Error en versión mejorada de ${analizador.nombre}:`, error);
                // Error en versión mejorada no afecta al resultado original
            }
        }

        // 3. Siempre devolver resultado original o neutro
        return resultadoOriginal;
    }

    /**
     * Ejecuta una función con reintentos
     * @private
     */
    async ejecutarConRetry(fn, nombreAnalizador, maxIntentos = 3) {
        let ultimoError;
        
        for (let intento = 1; intento <= maxIntentos; intento++) {
            try {
                return await fn();
            } catch (error) {
                ultimoError = error;
                logger.error(`Intento ${intento}/${maxIntentos} fallido para ${nombreAnalizador}:`, error);
                
                if (intento < maxIntentos) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * intento));
                }
            }
        }
        
        throw ultimoError;
    }

    /**
     * Genera un resultado neutro en caso de error
     * @private
     */
    generarResultadoNeutro(nombreAnalizador) {
        logger.info(`Generando resultado neutro para ${nombreAnalizador}`);
        return {
            confianza: 0,
            resultado: 'indeterminado',
            error: true
        };
    }

    /**
     * Ejecuta la versión mejorada del analizador
     * @private
     */
    async ejecutarVersionMejorada(analizador, rutaArchivo, resultadoOriginal) {
        if (!analizador.analizarV2) {
            throw new Error(`${analizador.nombre} no tiene implementación V2`);
        }

        const metricas = await medirRecursos(async () => {
            return await this.ejecutarConRetry(
                () => analizador.analizarV2(rutaArchivo),
                `${analizador.nombre}V2`
            );
        });

        logger.metricas({
            tipo: 'analisis_mejorado',
            analizador: `${analizador.nombre}V2`,
            ...metricas.datos
        });

        return {
            resultado: metricas.resultado,
            rendimiento: metricas.datos
        };
    }

    /**
     * Guarda los datos para la red superior
     * @private
     */
    async guardarDatosRedSuperior(datos) {
        try {
            // TODO: Implementar almacenamiento persistente
            logger.info('Datos para red superior:', datos);
        } catch (error) {
            logger.error('Error al guardar datos para red superior:', error);
        }
    }
}

module.exports = new WrapperAnalizador();
