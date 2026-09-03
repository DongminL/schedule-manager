/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // These are Node-only and must not be bundled for the browser / edge.
  serverExternalPackages: ["postgres", "ioredis", "bcryptjs"],
};

export default nextConfig;
