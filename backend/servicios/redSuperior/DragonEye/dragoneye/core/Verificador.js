/**
 * Verificador para Red Superior - Proyecto Dragon
 * Monitorea la salud y rendimiento de los analizadores en la red espejo
 * @author GustavoHerraiz
 * @date 2025-04-16
 */

import { VerificadorError, CODIGOS_ERROR, crearError } from './errores.js';

export class Verificador {
    constructor(logger, metricas) {
        if (!logger || !metricas) {
            throw new VerificadorError(
                CODIGOS_ERROR.INICIALIZACION,
                'Verificador requiere logger y métricas válidos'
            );
        }

        this.logger = logger;
        this.metricas = metricas;
        this.activo = false;
        this.ultimaVerificacion = null;
        this.verificacionesExitosas = 0;
        this.verificacionesFallidas = 0;
        this.intentosReconexion = 0;
        this.maxIntentosReconexion = 3;
        this.limiteP95 = 200; // milisegundos
    }

    async iniciar() {
        try {
            await this.metricas.establecerGauge('verificador_status', 1);
            this.activo = true;
            this.intervalId = setInterval(() => this.verificar(), 60000);
            
            this.logger.info('Verificador: Sistema iniciado', {
                timestamp: new Date().toISOString()
            });
            
            await this.verificar();
        } catch (error) {
            this.logger.error('Verificador: Error fatal al iniciar', {
                codigo: error.codigo || CODIGOS_ERROR.INICIALIZACION,
                mensaje: error.message,
                detalles: error.detalles
            });
            throw error;
        }
    }

    async detener() {
        try {
            clearInterval(this.intervalId);
            this.activo = false;
            await this.metricas.establecerGauge('verificador_status', 0);
            this.logger.info('Verificador: Sistema detenido correctamente');
        } catch (error) {
            this.logger.error('Verificador: Error al detener sistema', {
                error: error.message
            });
            throw crearError(CODIGOS_ERROR.INICIALIZACION, 'Error al detener el verificador');
        }
    }

    async verificar() {
        const inicio = Date.now();
        try {
            await this.verificarMemoria();
            await this.verificarRendimiento();
            await this.verificarConexiones();
            
            this.verificacionesExitosas++;
            this.ultimaVerificacion = new Date().toISOString();
            
            const tiempoTotal = Date.now() - inicio;
            await this.metricas.registrarTiempo('verificador_check_time', tiempoTotal);
            
            if (tiempoTotal > this.limiteP95) {
                this.logger.warn('Verificador: Verificación excedió P95', {
                    tiempoEjecucion: tiempoTotal,
                    limiteP95: this.limiteP95
                });
            }
            
            return true;
        } catch (error) {
            await this.manejarErrorVerificacion(error);
            return false;
        }
    }

    async verificarMemoria() {
        try {
            const uso = process.memoryUsage();
            await this.metricas.establecerGauge('verificador_heap_usage', uso.heapUsed / 1024 / 1024);
            return true;
        } catch (error) {
            throw crearError(CODIGOS_ERROR.MEMORIA, 'Error al verificar memoria', {
                heapUsed: process.memoryUsage().heapUsed
            });
        }
    }

    async verificarRendimiento() {
        const inicio = process.hrtime();
        try {
            await this.metricas.registrarTiempo('verificador_performance_check', 
                process.hrtime(inicio)[1] / 1000000);
            return true;
        } catch (error) {
            throw crearError(CODIGOS_ERROR.RENDIMIENTO, 'Error al verificar rendimiento');
        }
    }

    async verificarConexiones() {
        try {
            // Simulación de verificación de conexiones activas
            const conexionesActivas = Math.floor(Math.random() * 100);
            await this.metricas.establecerGauge('verificador_active_connections', conexionesActivas);
            return true;
        } catch (error) {
            throw crearError(CODIGOS_ERROR.CONEXION, 'Error al verificar conexiones');
        }
    }

    async manejarErrorVerificacion(error) {
        this.verificacionesFallidas++;
        this.intentosReconexion++;
        
        await this.metricas.incrementarContador('verificador_errors');
        
        if (this.intentosReconexion > this.maxIntentosReconexion) {
            this.logger.error('Verificador: Error crítico - máximo de intentos alcanzado', {
                codigo: error.codigo,
                mensaje: error.message,
                intentos: this.intentosReconexion
            });
            return false;
        }
        
        this.logger.warn('Verificador: Error recuperable', {
            codigo: error.codigo,
            mensaje: error.message,
            intento: this.intentosReconexion
        });
        
        return true;
    }

    calcularTasaExito() {
        const total = this.verificacionesExitosas + this.verificacionesFallidas;
        return total === 0 ? 1 : this.verificacionesExitosas / total;
    }

    obtenerEstado() {
        return {
            activo: this.activo,
            ultimaVerificacion: this.ultimaVerificacion,
            verificacionesExitosas: this.verificacionesExitosas,
            verificacionesFallidas: this.verificacionesFallidas,
            tasaExito: this.calcularTasaExito(),
            intentosReconexion: this.intentosReconexion
        };
    }
}
