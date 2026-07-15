// Configuración de la aplicación

const PRODUCTION_BACKEND_URL = "https://birdyval.onrender.com";

// Detecta automáticamente si estamos en local o producción
const isLocal =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname.startsWith("192.168.");

export const CONFIG = {
  BACKEND_URL: isLocal
    ? `http://${window.location.hostname}:8000`
    : PRODUCTION_BACKEND_URL,
  IS_LOCAL: isLocal,
};
