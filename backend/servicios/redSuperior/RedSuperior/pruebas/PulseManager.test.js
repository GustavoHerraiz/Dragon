import { emitPulse, monitorPulses, setPulseInterval } from "../utils/PulseManager.js";

const ejecutarPruebas = async () => {
  try {
    console.log("Iniciando pruebas de pulsos...");

    // Configurar monitoreo de pulsos
    monitorPulses();

    // Emitir un pulso manualmente
    emitPulse('testComponent', 123);

    // Cambiar el intervalo de pulsos
    setPulseInterval(500);

    // Emitir otro pulso manualmente con el nuevo intervalo
    emitPulse('testComponent', 500);

    console.log("Pruebas completadas. Revisa los logs para confirmar.");
  } catch (error) {
    console.error("Error en las pruebas de pulsos:", error.message);
  }
};

ejecutarPruebas();
