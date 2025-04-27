import sharp from 'sharp';
import winston from 'winston';

const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
            return `${timestamp} ${level}: ${message} ${JSON.stringify(meta)}`;
        })
    ),
    transports: [
        new winston.transports.Console()
    ]
});

// Funci�n para extraer los datos centrales (sin OCR, detecci�n de puntos)
export async function extraerDatosCentrales(imagenBuffer, centro) {
    try {
        // 1. Definir las posiciones de los caracteres (ajustar seg�n tu dise�o)
        const posiciones = [
            { x: centro.x - 20, y: centro.y },
            { x: centro.x - 10, y: centro.y },
            { x: centro.x + 0, y: centro.y },
            { x: centro.x + 10, y: centro.y },
            { x: centro.x + 20, y: centro.y }
        ];

        let datosCentrales = '';
        for (const posicion of posiciones) {
            // 2. Extraer el bloque de p�xeles
            const bloque = await extraerBloque(imagenBuffer, posicion);

            // 3. Verificar si hay un punto en el bloque
            const hayPunto = verificarPunto(bloque);

            // 4. Agregar un caracter a los datos centrales dependiendo de si hay un punto o no
            if (hayPunto) {
                datosCentrales += '1'; // Si hay un punto, agregamos un "1"
            } else {
                datosCentrales += '0'; // Si no hay un punto, agregamos un "0"
            }
        }

        logger.debug('Datos centrales extra�dos:', { datosCentrales });
        return datosCentrales;
    } catch (error) {
        logger.error('Error al extraer datos centrales:', { error: error.message, stack: error.stack });
        throw error; // Re-lanzar el error para que se maneje en un nivel superior
    }
}

// Funci�n auxiliar para extraer un bloque de p�xeles de la imagen
async function extraerBloque(imagenBuffer, posicion) {
    try {
        const bloqueSize = 10; // Tama�o del bloque (ajustar seg�n tu dise�o)
        const left = posicion.x - bloqueSize / 2;
        const top = posicion.y - bloqueSize / 2;

        const bloqueBuffer = await sharp(imagenBuffer)
            .extract({ left: Math.round(left), top: Math.round(top), width: bloqueSize, height: bloqueSize })
            .raw() // Obtener los p�xeles en formato raw
            .toBuffer();

        // Convertir el buffer a un array de n�meros (0-255)
        const bloquePixeles = Array.from(new Uint8Array(bloqueBuffer));

        logger.debug(`Tama�o del bloque de p�xeles: ${bloquePixeles.length}`);
        return bloquePixeles;
    } catch (error) {
        logger.error('Error al extraer bloque de p�xeles:', { error: error.message, stack: error.stack });
        throw error; // Re-lanzar el error
    }
}

// Funci�n auxiliar para verificar si hay un punto en el bloque de p�xeles
function verificarPunto(bloquePixeles) {
    try {
        // 1. Definir un umbral para la detecci�n de puntos
        const umbral = 128; // Ajustar seg�n sea necesario

        // 2. Contar el n�mero de p�xeles que tienen un valor superior al umbral
        let contador = 0;
        for (let i = 0; i < bloquePixeles.length; i++) {
            if (bloquePixeles[i] > umbral) {
                contador++;
            }
        }

        // 3. Definir un n�mero m�nimo de p�xeles para considerar que hay un punto
        const minimoPixeles = 10; // Ajustar seg�n sea necesario

        // 4. Si el n�mero de p�xeles es superior al m�nimo, entonces hay un punto
        if (contador > minimoPixeles) {
            logger.debug(`Punto detectado: ${contador} p�xeles > ${umbral}`);
            return true;
        } else {
            logger.debug(`Punto no detectado: ${contador} p�xeles <= ${umbral}`);
            return false;
        }
    } catch (error) {
        logger.error('Error al verificar punto:', { error: error.message, stack: error.stack });
        return false; // En caso de error, consideramos que no hay punto
    }
}

// Funci�n de detecci�n de la espiral (simplificada)
export async function detectarEspiral(imagenBuffer) {
  try {
    const metadata = await sharp(imagenBuffer).metadata();
    const centro = { x: metadata.width / 2, y: metadata.height / 2 };
    const puntos = [
      { x: centro.x - 20, y: centro.y },
      { x: centro.x - 10, y: centro.y },
      { x: centro.x + 0, y: centro.y },
      { x: centro.x + 10, y: centro.y },
      { x: centro.x + 20, y: centro.y }
    ];
    return { centro, puntos };
  } catch (error) {
    logger.error('Error al detectar espiral (simplificada):', { error: error.message, stack: error.stack });
    return null;
  }
}