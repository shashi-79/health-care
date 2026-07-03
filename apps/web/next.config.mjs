import os from "os";

const localIPs = Object.values(os.networkInterfaces())
  .flat()
  .filter((details) => details && details.family === "IPv4" && !details.internal)
  .map((details) => details.address);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    tsconfigPath: "./tsconfig.json"
  },
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    allowedDevOrigins: ["localhost", "127.0.0.1", ...localIPs]
  }
};

export default nextConfig;
