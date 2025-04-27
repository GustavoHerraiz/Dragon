/**
 * Métricas para Red Superior
 * Proyecto Dragón - v1.0.0
 * @author GustavoHerraiz
 * @date 2025-04-16 09:29:09
 */

class DragonEyeMetricas {
    constructor() {
        this.contadores = new Map();
        this.gauges = new Map();
        this.histogramas = new Map();
    }

    registrarTiempo(metrica, valor) {
        if (!this.histogramas.has(metrica)) {
            this.histogramas.set(metrica, []);
        }
        this.histogramas.get(metrica).push(valor);
    }

    incrementarContador(metrica) {
        const valorActual = this.contadores.get(metrica) || 0;
        this.contadores.set(metrica, valorActual + 1);
    }

    establecerGauge(metrica, valor) {
        this.gauges.set(metrica, valor);
    }

    obtenerMetricas() {
        return {
            contadores: Object.fromEntries(this.contadores),
            gauges: Object.fromEntries(this.gauges),
            histogramas: Object.fromEntries(this.histogramas)
        };
    }
}

export { DragonEyeMetricas };
