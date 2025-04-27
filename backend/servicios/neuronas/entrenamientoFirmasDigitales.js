import synaptic from 'synaptic';
import RedAnalisisFirmasDigitales from './analisisDeFirmasDigitales.js';
import fs from 'fs';

const { Trainer } = synaptic;

// Instancia de la red desde analisisDeFirmasDigitales.js
const red = new RedAnalisisFirmasDigitales().network;

// Cargar datos de entrenamiento
let trainingData = [];
try {
    const rawData = fs.readFileSync('./datosRedFirmasDigitales.json');
    const parsedData = JSON.parse(rawData);

    // Validar datos para asegurar que todas las entradas sean válidas y completas
    trainingData = parsedData.filter(entry => 
        Array.isArray(entry.input) && entry.input.length === 10 && 
        Array.isArray(entry.output) && entry.output.length === 1
    ).map(entry => ({
        input: entry.input.map(value => (isNaN(value) || value === null ? 0 : value)), // Corrección de valores inválidos
        output: entry.output
    }));

    console.log('✅ Datos procesados y validados para el entrenamiento:', trainingData);
} catch (error) {
    console.error('⚠️ Error al cargar y procesar datos de entrenamiento:', error.message);
}

// Configuración de hiperparámetros
const configuraciones = [
    { rate: 0.1, iterations: 5000, error: 0.05 },
    { rate: 0.3, iterations: 7000, error: 0.03 },
    { rate: 0.7, iterations: 3000, error: 0.1 },
];

// Función para entrenar el modelo
function entrenarModelo() {
    const trainer = new Trainer(red);

    configuraciones.forEach((config, index) => {
        console.time(`⏱️ Tiempo de configuración ${index + 1}`);
        console.log(`🔧 Iniciando configuración ${index + 1}:`, config);

        const resultado = trainer.train(trainingData, config);
        console.log(`✅ Configuración ${index + 1} completada. Error final: ${resultado.error}`);
        console.timeEnd(`⏱️ Tiempo de configuración ${index + 1}`);

        fs.appendFileSync('./logs/trainingMetricsFirmasDigitales.log', `Configuración ${index + 1}:\nError final: ${resultado.error}\n\n`);
    });

    // Guardar los pesos entrenados
    const redEntrenada = red.toJSON();
    fs.writeFileSync('./RedDeFirmasDigitales_Entrenada.json', JSON.stringify(redEntrenada, null, 2));
    console.log('✅ Red entrenada guardada en RedDeFirmasDigitales_Entrenada.json');
}

entrenarModelo();
