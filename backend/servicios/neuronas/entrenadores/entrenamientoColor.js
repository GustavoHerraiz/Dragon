import synaptic from "synaptic"; // Para la red neuronal
import fs from "fs"; // Para manejo de archivos

const { Trainer } = synaptic;

// Instancia de la red neuronal
const red = new synaptic.Architect.Perceptron(10, 5, 1); // 10 entradas, 5 capas ocultas, 1 salida

// Cargar datos de entrenamiento
let trainingData = [];
try {
    const rawData = fs.readFileSync("./datosRedColor.json", "utf8");
    const parsedData = JSON.parse(rawData);

    // Validar datos para asegurar que las entradas y salidas sean válidas
    trainingData = parsedData.filter(entry => 
        Array.isArray(entry.input) && entry.input.length === 10 &&
        Array.isArray(entry.output) && entry.output.length === 1
    ).map(entry => ({
        input: entry.input.map(value => (isNaN(value) || value === null ? 0 : value)), // Ajusta valores inválidos
        output: entry.output
    }));

    console.log("✅ Datos procesados y validados para el entrenamiento:", trainingData);
} catch (error) {
    console.error("⚠️ Error al cargar y procesar datos de entrenamiento:", error.message);
}

// Configuración de hiperparámetros
const configuraciones = [
    { rate: 0.2, iterations: 5000, error: 0.05 },
    { rate: 0.3, iterations: 7000, error: 0.03 },
    { rate: 0.5, iterations: 3000, error: 0.1 },
];

// Función para entrenar el modelo
function entrenarModelo() {
    const trainer = new Trainer(red); // Usamos la red directamente

    configuraciones.forEach((config, index) => {
        console.time(`⏱️ Tiempo de configuración ${index + 1}`); // Cronómetro para la configuración
        console.log(`🔧 Configuración ${index + 1}:`, config);

        // Entrenar la red neuronal con la configuración actual
        const resultado = trainer.train(trainingData, config);
        console.log(`✅ Configuración ${index + 1} completada. Error final: ${resultado.error}`);
        console.timeEnd(`⏱️ Tiempo de configuración ${index + 1}`); // Detener cronómetro

        // Registro en archivo de métricas
        fs.appendFileSync("./logs/trainingMetricsColor.log", `Configuración ${index + 1}:\nError final: ${resultado.error}\n\n`);
    });

    // Guardar el modelo entrenado con la estructura correcta
    const modeloEntrenado = red.toJSON();
    fs.writeFileSync("./RedDeColor_Entrenada.json", JSON.stringify(modeloEntrenado, null, 2));
    console.log("✅ Red entrenada guardada como RedDeColor_Entrenada.json");
}

entrenarModelo();
