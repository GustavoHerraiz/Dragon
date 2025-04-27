/**
 * DragonEye - Sistema de Verificación de Red Superior
 * Proyecto Dragon - Red Superior
 * @author GustavoHerraiz
 * @date 2025-04-16
 */

import { DragonEyeError, CODIGOS_ERROR } from './errores.js';

export class DragonEye {
    /**
     * @param {Object} logger Instancia de Winston
     * @param {Object} metricas Servicio de métricas
     * @param {Object} verificador Instancia del Verificador
     * @param {Object} monitor Instancia del Monitor
     */
    constructor(logger, metricas, verificador, monitor) {
        if (!logger || !metricas || !verificador || !monitor) {
            throw new DragonEyeError(
                CODIGOS_ERROR.INICIALIZACION,
                'DragonEye requiere todas las dependencias'
            );
        }

        this.logger = logger;
        this.metricas = metricas;
        this.verificador = verificador;
        this.monitor = monitor;
        this.activo = false;
    }

    /**
     * Inicia el servicio DragonEye
     */
    async iniciar() {
        try {
            this.logger.info('DragonEye: Iniciando servicio');
            await this.verificador.iniciar();
            await this.monitor.iniciar();
            this.activo = true;
            await this.monitor.registrarEvento('SISTEMA_INICIADO', {
                timestamp: new Date().toISOString()
            });
            this.logger.info('DragonEye: Servicio iniciado correctamente');
        } catch (error) {
            this.logger.error('DragonEye: Error durante el inicio', { error });
            throw new DragonEyeError(
                CODIGOS_ERROR.INICIALIZACION,
                'Error al iniciar DragonEye',
                { error: error.toString() }
            );
        }
    }

    /**
     * Detiene el servicio DragonEye
     */
    async detener() {
        try {
            this.logger.info('DragonEye: Deteniendo servicio');
            await this.monitor.registrarEvento('SISTEMA_DETENIDO', {
                timestamp: new Date().toISOString()
            });
            await this.verificador.detener();
            await this.monitor.detener();
            this.activo = false;
            this.logger.info('DragonEye: Servicio detenido correctamente');
        } catch (error) {
            this.logger.error('DragonEye: Error durante la detención', { error });
            throw error;
        }
    }

    /**
     * Verifica un conjunto de nodos
     * @param {Array} nodos Lista de nodos a verificar
     * @returns {Object} Resultado de la verificación
     */
    async verificarNodos(nodos) {
        if (!this.activo) {
            throw new DragonEyeError(
                CODIGOS_ERROR.SERVICIO_INACTIVO,
                'DragonEye no está activo'
            );
        }

        try {
            const inicio = Date.now();
            const resultado = await this.verificador.verificarNodos(nodos);
            const tiempo = Date.now() - inicio;

            await this.monitor.registrarEvento('VERIFICACION_COMPLETADA', {
                nodos: nodos.length,
                tiempo,
                resultado: resultado.estado
            });

            await this.metricas.registrarHistograma(
                'dragoneye_tiempo_verificacion',
                tiempo
            );

            return resultado;
        } catch (error) {
            this.logger.error('DragonEye: Error durante la verificación', {
                error,
                nodos: nodos.length
            });

            try {
                await this.monitor.registrarEvento('ERROR_VERIFICACION', {
                    error: error.toString(),
                    nodos: nodos.length,
                    timestamp: new Date().toISOString()
                });

                await this.metricas.incrementarContador('dragoneye_errores_verificacion');
            } catch (errorSecundario) {
                this.logger.error('DragonEye: Error al registrar error', {
                    errorOriginal: error,
                    errorSecundario
                });
            }

            // Si es un error crítico, lo propagamos como DragonEyeError
            if (error instanceof DragonEyeError && error.codigo === CODIGOS_ERROR.ERROR_CRITICO) {
                throw error;
            }

            // Para otros errores, los envolvemos en DragonEyeError
            throw new DragonEyeError(
                CODIGOS_ERROR.ERROR_VERIFICACION,
                'Error durante la verificación de nodos',
                { error: error.toString() }
            );
        }
    }

    /**
     * Obtiene el estado actual del sistema
     * @returns {Object} Estado del sistema
     */
    obtenerEstado() {
        return {
            activo: this.activo,
            verificador: this.verificador.obtenerEstado(),
            monitor: this.monitor.obtenerEstado()
        };
    }
}
