import RedSuperior from "./redSuperior.js";

// Instanciar la Red Superior
const redSuperior = new RedSuperior();

// Datos de entrada simulados (10 valores normalizados entre 0 y 1)
const datosEntrada = [0.8, 0.1, 0.2, 0.6, 0.9, 0.3, 0.4, 0.7, 0.5, 0.2];

async function ejecutarPrueba() {
  try {
    console.log("🚀 Iniciando prueba de la Red Superior...");

    // Validar datos de entrada
    if (!Array.isArray(datosEntrada) || datosEntrada.length !== 10 || !datosEntrada.every(num => num >= 0 && num <= 1)) {
      throw new Error("❌ Los datos de entrada deben ser un array de 10 valores normalizados entre 0 y 1.");
    }

    // Analizar los datos y enviar el pulso
    const resultado = await redSuperior.analizar(datosEntrada);

    console.log("✅ Resultado de la Red Superior:", resultado);
  } catch (error) {
    console.error("❌ Error al ejecutar la Red Superior:", error.message);
  } finally {
    // Cerrar el cliente Redis
    await redSuperior.redisClient.quit();
    console.log("🛑 Cliente de Redis cerrado correctamente.");
  }
}

ejecutarPrueba();
