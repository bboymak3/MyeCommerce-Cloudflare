/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config) => {
    // jspdf referencia canvas y fflate como deps opcionales internas.
    // canvas requiere compilacion nativa (no disponible en Windows facil).
    // fflate no se usa en nuestro flujo. Se ignora para evitar errores.
    config.resolve.alias = {
      ...config.resolve.alias,
      'canvas': false,
      'fflate': false,
    };
    return config;
  },
};

module.exports = nextConfig;
