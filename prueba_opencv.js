import cv from "opencv4nodejs";

try {
    console.log("Versión de OpenCV en Node.js:", cv.version);
    console.log("Compilación de OpenCV:", cv.xmodules);
} catch (error) {
    console.error("Error cargando opencv4nodejs:", error.message);
}
