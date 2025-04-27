import { analizarImagen } from "../analizadorImagen.js";

const ejecutarPruebas = async () => {
  try {
    // Prueba con datos válidos
    const datosValidos = [128, 64, 255, 32, 16, 8, 4, 2, 1, 0];
    const resultadoValido = await analizarImagen(datosValidos);
    console.log("Prueba con datos válidos:", resultadoValido);

    // Prueba con datos vacíos
    try {
      const datosVacios = [];
      await analizarImagen(datosVacios);
    } catch (error) {
      console.error("Prueba con datos vacíos (esperado):", error.message);
    }

    // Prueba con datos corruptos
    try {
      const datosCorruptos = [128, "invalid", 255, null];
      await analizarImagen(datosCorruptos);
    } catch (error) {
      console.error("Prueba con datos corruptos (esperado):", error.message);
    }
  } catch (error) {
    console.error("Error en las pruebas:", error.message);
  }
};

ejecutarPruebas();
