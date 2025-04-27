import { DragonSensor } from '../lib/DragonSensor.js';
import { DragonEye } from '../lib/DragonEye.js';

// Crear una instancia de DragonEye para monitorear
const eye = new DragonEye();

// Crear un sensor para un componente
const sensor = new DragonSensor('mi-componente');

// Escuchar eventos en DragonEye
eye.on('event', (data) => {
    console.log('Evento recibido:', data);
});

// Enviar eventos desde el sensor
await sensor.pulse({
    type: 'test-event',
    data: { mensaje: 'Hola Mundo' }
});

// Verificar estado
const eyeHealth = await eye.isHealthy();
const sensorHealth = await sensor.isHealthy();

console.log('Estado del sistema:', { eye: eyeHealth, sensor: sensorHealth });
