/**
 * Monitor para DragonEye
 * Monitoreo y análisis de eventos del sistema
 * Proyecto Dragon - Red Superior
 * @author GustavoHerraiz
 * @date 2025-04-16
 */

import { DragonEyeError, CODIGOS_ERROR } from './errores.js';

const TIPOS_EVENTO = {
    ERROR_CRITICO: 'ERROR_CRITICO',
    ERROR_PROCESAMIENTO: 'ERROR_PROCESAMIENTO',
    TEST_EVENT: 'TEST_EVENT'
};

export class Monitor {
    /**
     * Constructor del Monitor
     * @param {Object} logger - Instancia de Winston logger
     * @param {Object} metricas - Servicio de métricas
     */
    constructor(logger, metricas) {
        if (!logger || !metricas) {
            throw new DragonEyeError(
                CODIGOS_ERROR.INICIALIZACION,
                'Monitor requiere logger y métricas'
            );
        }

        this.logger = logger;
        this.metricas = metricas;
        this.activo = false;
        this.eventos = [];
        this.ultimoEvento = null;
        this.MAX_EVENTOS = 100;
        this.UMBRAL_PATRON = 5;
        this.patrones = new Map();
        this.eventosPersistidos = [];
    }

    /**
     * Inicia el servicio de monitoreo
     */
    async iniciar() {
        try {
            this.activo = true;
            await this.cargarEventosPersistentes();
            this.logger.info('Monitor: Servicio iniciado correctamente', {
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            this.activo = false;
            throw new DragonEyeError(
                CODIGOS_ERROR.ERROR_CRITICO,
                'Error al iniciar el monitor',
                { error: error.toString() }
            );
        }
    }

    /**
     * Detiene el servicio de monitoreo
     */
    async detener() {
        try {
            await this.persistirEventosCriticos();
            this.eventos = [];
            this.ultimoEvento = null;
            this.patrones.clear();
            this.activo = false;
            this.logger.info('Monitor: Servicio detenido correctamente', {
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            this.logger.error('Monitor: Error durante la detención', {
                error: error.toString()
            });
            throw error;
        }
    }

    /**
     * Registra un nuevo evento en el sistema
     * @param {string} tipo - Tipo de evento
     * @param {Object} detalles - Detalles del evento
     */
    async registrarEvento(tipo, detalles = {}) {
        if (!this.activo) {
            throw new DragonEyeError(
                CODIGOS_ERROR.MONITOR,
                'Monitor no está activo'
            );
        }

        if (!Object.values(TIPOS_EVENTO).includes(tipo)) {
            throw new DragonEyeError(
                CODIGOS_ERROR.VALIDACION,
                'Tipo de evento inválido'
            );
        }

        const evento = {
            tipo,
            detalles,
            timestamp: new Date().toISOString()
        };

        this.eventos.push(evento);
        this.ultimoEvento = evento;

        // Mantener límite de eventos
        if (this.eventos.length > this.MAX_EVENTOS) {
            this.eventos.shift();
        }

        // Incrementar contador de patrón
        const patronActual = this.patrones.get(tipo) || 0;
        this.patrones.set(tipo, patronActual + 1);

        // Analizar patrones
        if (patronActual + 1 >= this.UMBRAL_PATRON) {
            this.logger.warn('Monitor: Detectado patrón de errores', {
                tipo,
                ocurrencias: patronActual + 1,
                umbral: this.UMBRAL_PATRON
            });
        }

        // Métricas específicas por tipo
        if (tipo === TIPOS_EVENTO.ERROR_CRITICO) {
            await this.metricas.incrementarContador('dragoneye_eventos_criticos');
        }

        await this.metricas.establecerGauge('dragoneye_eventos_total', this.eventos.length);
    }

    /**
     * Obtiene el estado actual del monitor
     * @returns {Object} Estado del monitor
     */
    obtenerEstado() {
        return {
            activo: this.activo,
            totalEventos: this.eventos.length,
            ultimoEvento: this.ultimoEvento,
            patrones: Array.from(this.patrones.entries()).map(([tipo, ocurrencias]) => ({
                tipo,
                ocurrencias
            }))
        };
    }

    /**
     * Persiste eventos críticos para recuperación
     * @private
     */
    async persistirEventosCriticos() {
        this.eventosPersistidos = this.eventos.filter(
            e => e.tipo === TIPOS_EVENTO.ERROR_CRITICO
        );
        return Promise.resolve();
    }

    /**
     * Carga eventos críticos persistidos
     * @private
     */
    async cargarEventosPersistentes() {
        if (this.eventosPersistidos && this.eventosPersistidos.length > 0) {
            this.eventos = [...this.eventosPersistidos];
            this.ultimoEvento = this.eventos[this.eventos.length - 1];
        }
        return Promise.resolve();
    }
}
