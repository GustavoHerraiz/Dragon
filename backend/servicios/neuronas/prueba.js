import RedAnalisisDefinicion from './analisisDeDefinicion.js';

const red = new RedAnalisisDefinicion(); // Instancia de la clase refactorizada

const datosPrueba = [0.2, 0.4, 0.6, 0.8, 0.1, 0.3, 0.7, 0.5, 0.9, 0.0];

async function ejecutarPrueba() {
    const resultado = await red.analizar(datosPrueba); // Llamada al método "analizar" de la clase
    console.log('Resultado del análisis:', resultado);
}

ejecutarPrueba();
