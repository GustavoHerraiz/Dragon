import synaptic from "synaptic";
import fs from "fs";

const { Trainer, Architect } = synaptic;

// Crear la red neuronal para analizar resolución
const red = new Architect.Perceptron(5, 10, 1); // 5 inputs, 10 nodos ocultos, 1 salida

// Generar datos representativos
const generarDatos = () => {
  const datosIA = Array.from({ length: 100 }, () => ({
    input: [0.1, 0.3, 0.2, 0.1, 0.2], // Resolución baja, proporción atípica, densidad 72 ppi
    output: [0] // Etiqueta: IA
  }));

  const datosHumanos = Array.from({ length: 100 }, () => ({
    input: [0.9, 0.8, 0.7, 0.9, 1.0], // Resolución alta, proporción estándar, densidad 300 ppi
    output: [1] // Etiqueta: Humano
  }));

  return [...datosIA, ...datosHumanos];
};

const trainingData = generarDatos();
console.log("✅ Datos generados para entrenamiento:", trainingData);

// Entrenar la red neuronal
const trainer = new Trainer(red);
const trainingConfig = {
  rate: 0.1,
  iterations: 20000,
  error: 0.005,
  shuffle: true,
  log: 500,
};

console.log("🚀 Iniciando el entrenamiento...");
trainer.train(trainingData, trainingConfig);
console.log("✅ Entrenamiento completado.");

// Guardar la red entrenada
const redEntrenada = red.toJSON();
fs.writeFileSync("./RedDeResolucion_Entrenada.json", JSON.stringify(redEntrenada, null, 2));
console.log("✅ Modelo entrenado guardado en RedDeResolucion_Entrenada.json");
