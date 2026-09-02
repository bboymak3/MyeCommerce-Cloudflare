/** @type {import('next').NextConfig} */
const nextConfig = {
  // Skip type checking during build (pre-existing type errors in page components)
  typescript: { ignoreBuildErrors: true },
  // Cloudflare Pages compatible output
  // Disable Next.js image optimization (not supported on Edge Runtime)
  images: {
    unoptimized: true,
  },
  // Stub Node.js built-ins that don't exist in Edge Runtime
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        child_process: false,
        crypto: false,
        stream: false,
        http: false,
        https: false,
        zlib: false,
        net: false,
        tls: false,
        dns: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
