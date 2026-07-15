/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  basePath: "/futureos-app",
  assetPrefix: "/futureos-app/",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
