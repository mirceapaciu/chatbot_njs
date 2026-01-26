/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    instrumentationHook: true,
    serverComponentsExternalPackages: ['onnxruntime-node'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('onnxruntime-node');

      // Ensure Node built-ins are not bundled (needed for instrumentation/boot code)
      config.externals.push({
        fs: 'commonjs fs',
        'fs/promises': 'commonjs fs/promises',
        http: 'commonjs http',
        https: 'commonjs https',
        path: 'commonjs path',
        zlib: 'commonjs zlib',
      });
    }
    return config;
  },
};

module.exports = nextConfig;
