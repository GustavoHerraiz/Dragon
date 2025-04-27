/**
 * @fileoverview Entrenamiento de Red Neuronal para Análisis de Texturas
 * @version 1.0.0
 * @author GustavoHerraiz
 * @date 2025-04-14 20:08:21
 * @description Red neuronal especializada en el análisis de patrones de textura
 * para la detección de imágenes sintéticas vs naturales.
 */

import synaptic from 'synaptic';
import fs from 'fs';
import path from 'path';

const { Layer, Network, Trainer } = synaptic;

// Estructura de la red
const inputLayer = new Layer(10);
const hiddenLayer = new Layer(5);
const outputLayer = new Layer(1);

inputLayer.project(hiddenLayer);
hiddenLayer.project(outputLayer);

const network = new Network({
    input: inputLayer,
    hidden: [hiddenLayer],
    output: outputLayer
});

// Datos de entrenamiento calibrados
const trainingData = [
    {
        input: [0.92, 0.88, 0.12, 0.85, 0.76, 0.91, 0.68, 0.45, 0.89, 0.94],
        output: [1]
    },
    {
        input: [0.45, 0.97, 0.93, 0.32, 0.89, 0.42, 0.96, 0.91, 0.38, 0.41],
        output: [0]
    },
    {
        input: [0.87, 0.82, 0.15, 0.78, 0.72, 0.85, 0.65, 0.48, 0.84, 0.88],
        output: [1]
    },
    {
        input: [0.38, 0.95, 0.91, 0.29, 0.92, 0.35, 0.94, 0.88, 0.31, 0.39],
        output: [0]
    }
];

// Entrenamiento
const trainer = new Trainer(network);
const resultado = trainer.train(trainingData, {
    rate: 0.1,
    iterations: 5000,
    error: 0.05
});

console.log(`
Entrenamiento completado:
- Error final: ${resultado.error}
- Iteraciones: ${resultado.iterations}
- Tiempo: ${resultado.time}ms
`);

// Obtener la red entrenada en formato JSON
const networkData = network.toJSON();

// Crear el formato esperado por RedAnalisisTextura
const redEntrenada = {
    neurons: networkData.neurons.map((neuron, index) => ({
        trace: {
            elegibility: {},
            extended: {}
        },
        state: 0,
        old: 0,
        activation: 0,
        bias: neuron.bias || 0.05,
        layer: index < 10 ? "input" : (index < 15 ? 0 : "output"),
        squash: "LOGISTIC"
    })),
    connections: networkData.connections.map(conn => ({
        from: conn.from,
        to: conn.to,
        weight: conn.weight,
        gater: null
    }))
};

// Guardar el modelo entrenado
const outputPath = '/var/www/ProyectoDragon/backend/servicios/neuronas/RedDeTextura_Entrenada.json';
fs.writeFileSync(outputPath, JSON.stringify(redEntrenada, null, 2));

console.log(`
✅ Red neuronal entrenada y guardada correctamente:
- Archivo: ${outputPath}
- Error final: ${resultado.error}
- Arquitectura: 10-5-1
- Función de activación: LOGISTIC
`);

// Realizar prueba de validación
const testInput = [0.85, 0.45, 0.23, 0.78, 0.65, 0.34, 0.89, 0.21, 0.76, 0.82];
const prediction = network.activate(testInput);
console.log(`
Prueba de validación:
Input: ${JSON.stringify(testInput)}
Predicción: ${prediction[0]}
Interpretación: ${prediction[0] > 0.5 ? "Textura Natural" : "Textura Sintética"}
`);
