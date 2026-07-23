/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@tecpap/ui'],
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
};

export default nextConfig;
