export const normalizarDatos = (datos) => {
  return datos.map((valor) => parseFloat((valor / 10).toFixed(2)));
};
