Documento Maestro: Proyecto Dragón
1. Visión General
El Proyecto Dragón es un sistema modular diseñado para analizar datos multimedia (imágenes, PDFs, videos, etc.) con precisión y profundidad. Su estructura está basada en el concepto de “binomios” de analizadores y redes neuronales, lo que permite:

Especialización: Cada analizador tiene una red neuronal “espejo” que complementa su análisis.

Escalabilidad: La estructura puede replicarse para otros formatos de datos.

2. Jerarquía Modular
La organización de Dragón está diseñada estratégicamente:

Binomio (Unidad básica):

Analizador: Responsable de procesar datos específicos.

Red neuronal espejo: Complementa al analizador con análisis avanzado.

Escuadra (Coordina varios binomios):

ServidorCentral.js: Integra los resultados de los analizadores y redes neuronales en tiempo real.

Unidad Superior:

Una futura red neuronal avanzada supervisará los análisis globales, identificará patrones y optimizará todo el sistema.

3. Estado Actual de los Analizadores
Definición: Red espejo activa

Artefactos: Red espejo activa

Color: Sin red espejo aún

EXIF Metadata: Sin red espejo aún

Firmas digitales: Sin red espejo aún

Pantalla: Sin red espejo aún

Resolución: Sin red espejo aún

Textura: Sin red espejo aún

Validador de imágenes: Sin red espejo aún

4. Plantilla para Redes Espejo
El proyecto cuenta con una plantilla para crear redes espejo, lo que facilita:

Estandarización: Un diseño consistente para todas las redes.

Agilidad: Acelera el desarrollo de nuevas redes espejo.

Facilidad de mantenimiento: Estructura común para identificar mejoras y errores.

5. Estructura del Proyecto
Basado en el árbol de directorios, Dragón está organizado así:

Backend:

analizadores/: Módulos para analizar características específicas (color, textura, definición, etc.).

neuronas/: Redes neuronales espejo, cada una optimizada para un analizador.

servicios/: Funciones principales, como analizarImagen.js.

server.js: Servidor central para coordinar los análisis.

Frontend:

Páginas HTML para interacción con usuarios, como carga de archivos o visualización de resultados.

Conexión con el backend para enviar datos y recibir análisis.

Entrenamiento:

entrenamiento/: Almacena datos etiquetados para entrenar las redes neuronales.

6. Estado Actual
Todos los analizadores están activos.

Actualmente hay dos redes espejo activas: Definición y Artefactos.

Los analizadores restantes necesitan sus redes espejo correspondientes.

La plantilla para redes espejo está lista y en uso para agilizar el desarrollo.

7. Planes Futuros
Análisis de PDFs: Implementar analizadores para texto, imágenes incrustadas y propiedades del archivo.

Análisis de Videos: Dividir videos en frames clave y aplicar la lógica de los analizadores espejo.

Red Neuronal Superior: Transformar servidorCentral.js o añadir una capa superior que analice patrones globales y optimice todo el sistema.

Redes Sociales: Integrar APIs para analizar contenido multimedia desde redes sociales

8. Flujo funcional actualizado
Con las últimas mejoras en la plantilla de redes espejo, hemos estandarizado el proceso de integración entre los analizadores, sus redes espejo y el servidor central. Este flujo garantiza una comunicación clara y efectiva, evitando errores de transmisión o procesamiento. Aquí está el detalle:

Flujo de conexión e intercambio de datos
Inicialización de la red espejo:

Cada red comienza por establecer una conexión con el servidor central utilizando WebSocket.

Envía un mensaje inicial con los campos requeridos: red, salida y detalles. Ejemplo:

json
{
  "red": "nombreRed",
  "salida": 1,
  "detalles": {
    "mensaje": "Conexión inicial exitosa."
  }
}
Recepción de órdenes del servidor central:

El servidor central genera órdenes basadas en los datos enviados por los analizadores. Ejemplo:

json
{
  "tipo": "orden",
  "mensaje": "Ajustes obligatorios. Debe ejecutarlos de inmediato.",
  "ordenes": [
    {
      "parametro": "peso_densidad",
      "nuevo_valor": 0.25
    },
    {
      "parametro": "notificacion",
      "mensaje": "Primera revisión completada, ajustes en progreso."
    }
  ]
}
Procesamiento de órdenes en la red espejo:

La red actualiza los parámetros correspondientes según las órdenes recibidas.

Cada parámetro modificado se registra con un log detallado:

javascript
logger.info(`✅ Peso actualizado: ${orden.parametro} → ${orden.nuevo_valor}`);
Confirmación de ejecución:

Tras completar los ajustes, la red espejo envía un mensaje de confirmación al servidor central. Ejemplo:

json
{
  "tipo": "confirmacion",
  "mensaje": "Órdenes ejecutadas con éxito.",
  "detalles": [
    {
      "parametro": "peso_densidad",
      "nuevo_valor": 0.25
    },
    {
      "parametro": "notificacion",
      "mensaje": "Primera revisión completada, ajustes en progreso."
    }
  ]
}
Análisis y envío de resultados:

La red espejo realiza el análisis sobre los datos de entrada.

Los resultados incluyen un score y detalles complementarios sobre el análisis. Ejemplo:

json
{
  "red": "nombreRed",
  "salida": 6.5,
  "detalles": {
    "mensaje": "La imagen tiene características intermedias."
  }
}
Validación continua:

La red verifica que todos los mensajes enviados y recibidos cumplan con el formato esperado, y registra cualquier error o inconsistencia para depuración.

Mejoras clave en la plantilla
Validaciones:

Antes de enviar cualquier mensaje, se verifican todos los campos obligatorios.

Esto evita errores de transmisión y asegura que los datos lleguen completos al servidor central.

Logs detallados:

Cada paso del proceso se registra, facilitando la depuración en caso de problemas.

Estandarización del flujo:

El manejo de mensajes y órdenes sigue un esquema uniforme para todas las redes espejo.

Este flujo funcional representa un estándar robusto para la comunicación entre analizadores, redes espejo y el servidor central. Con él, Dragón asegura precisión y eficiencia en cada etapa del análisis.
