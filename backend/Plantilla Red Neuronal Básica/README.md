README.md
markdown
# Analizador Optimizado - Blade Corporation

## Descripción
El **Analizador Optimizado** es una herramienta avanzada desarrollada por **Blade Corporation**, líder en innovación tecnológica y soluciones de inteligencia artificial. Este analizador utiliza la lógica PMR (Plantilla Matemática Reutilizable) para procesar datos, calcular un score y distinguir entre características humanas y sintéticas (IA).

Diseñado para ser modular y escalable, este analizador facilita la integración con diversos proyectos y ofrece resultados precisos que se pueden adaptar a múltiples casos de uso.

---

## Requisitos
Antes de utilizar este analizador, asegúrate de contar con:
- **Node.js** instalado en tu sistema.
- Las siguientes librerías, que se pueden instalar usando `npm`:
  - `synaptic`: Para la red neuronal.
  - `winston`: Para manejo de logs.
  - `ws`: Para conexión WebSocket.
  - `fs`: Para manejo de archivos.
- Un modelo neuronal entrenado (`modelo.json`) o usa la red neuronal inicializada por defecto.

---

## Instalación

### 1. Clona el proyecto
```bash
git clone https://tu-repositorio/analizadorOptimizado.git
cd analizadorOptimizado
2. Instala las dependencias
bash
npm install synaptic winston ws fs
Configuración Inicial
Parámetros del analizador
En el archivo principal, define los parámetros del análisis. Ejemplo:

javascript
const parametros = [
  { nombre: "Resolución Horizontal", peso: 0.1 },
  { nombre: "Resolución Vertical", peso: 0.1 },
  { nombre: "Proporción Dimensiones", peso: 0.1 },
  { nombre: "Densidad", peso: 0.15 },
  { nombre: "Complejidad", peso: 0.15 },
  { nombre: "Ancho", peso: 0.1 },
  { nombre: "Alto", peso: 0.1 },
  { nombre: "Uniformidad", peso: 0.1 },
  { nombre: "Gradiente Promedio", peso: 0.1 },
  { nombre: "Artefactos Detectados", peso: 0.05 },
];
Modelo neuronal
Ubica tu modelo entrenado en la carpeta del proyecto como modelo.json.

Si no tienes un modelo, el analizador inicializará una red neuronal básica automáticamente.

Uso del Analizador
Importar y crear una instancia
javascript
import AnalizadorOptimizado from "./AnalizadorOptimizado.js";

const analizador = new AnalizadorOptimizado(
  "RedNeuronal", // Nombre del analizador
  "./modelo.json", // Ruta al modelo neuronal
  parametros, // Lista de parámetros
  10 // Escalador para el score (opcional)
);
Procesar datos
Proporciona una lista de valores para analizar:

javascript
const datos = [0.8, 0.6, 0.9, 0.7, 0.5, 0.4, 0.6, 0.7, 0.8, 0.1];
const resultado = analizador.analizar(datos);
console.log(resultado);
Resultado esperado
El análisis devolverá un objeto con información como:

json
{
  "nombreAnalizador": "RedNeuronal",
  "score": 6.5,
  "detalles": {
    "mensaje": "Características predominantemente humanas."
  }
}
Conexión con el Servidor Central
El analizador se conecta automáticamente al servidor central (ws://localhost:8080):

En caso de conexión exitosa, envía los resultados en tiempo real.

Si la conexión falla, intenta reconectar automáticamente cada 5 segundos.

Personalización
Añadir parámetros
Puedes incluir nuevos parámetros actualizando la lista inicial en la configuración:

javascript
const parametros = [
  { nombre: "Nuevo Parámetro", peso: 0.05 },
  // Otros parámetros existentes...
];
Modificar pesos
Ajusta los valores de peso para cambiar la importancia relativa de cada parámetro en el cálculo.

Entrenar un nuevo modelo
Si necesitas un modelo personalizado:

Usa Synaptic para entrenarlo con tus datos.

Guarda el modelo como modelo.json.

Soporte
Para preguntas o asistencia, contacta al equipo de desarrollo en Blade Corporation o consulta la documentación en línea de las librerías utilizadas:

Synaptic

Winston

WebSocket

Blade Corporation, 2025. Todos los derechos reservados.


---

Este README en formato Markdown es claro, detallado y fácil de entender, incluso para alguien sin experiencia técnica. Si prefieres, puedo adaptarlo a un archivo de texto plano (README.txt). 🚀✨
