/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config, { isServer }) => {
    // Ignorar dependencias opcionales de jspdf que no se usan
    // html2canvas, dompurify y canvg son opcionales pero webpack
    // intenta resolverlas y falla si no estan instaladas
    config.resolve.alias = {
      ...config.resolve.alias,
      'html2canvas': false,
      'dompurify': false,
      'canvg': false,
      'fflate': false,
    };
    // Evitar que webpack intente bundle node:canvas en client
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
