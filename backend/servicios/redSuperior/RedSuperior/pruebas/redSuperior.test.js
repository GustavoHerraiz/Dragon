import { createClient } from 'redis';
import { analizarDatos, enviarPulso } from '../redSuperior.js';
import logger from '../utils/logger.js';

async function ejecutarPruebas() {
    const client = createClient();

    try {
        await client.connect();
        logger.info('Iniciando pruebas completas de la Red Superior con pulsos...');

        // Prueba con datos válidos
        const datosValidos = { input: 'imagenValida.jpg', metadata: { id: '12345', origen: 'frontend' } };
        const { decision, confianza, analysisTime } = await analizarDatos(datosValidos);

        // Enviar pulso
        const canal = 'dragon:pulse:redSuperior';
        const pulseTime = await enviarPulso(client, canal, decision, confianza, datosValidos.metadata);

        logger.info(`?? Tiempos totales: Análisis (${analysisTime.toFixed(2)}ms), Envío (${pulseTime.toFixed(2)}ms)`);
    } catch (error) {
        logger.error(`? Error durante las pruebas: ${error.message}`);
    } finally {
        if (client.isOpen) {
            await client.quit();
            logger.info('Cliente de Redis cerrado.');
        }
    }
}

ejecutarPruebas().then(() => {
    logger.info('Pruebas completadas. Revisa los logs para confirmar.');
}).catch((error) => {
    logger.error(`? Error inesperado en las pruebas: ${error.message}`);
});