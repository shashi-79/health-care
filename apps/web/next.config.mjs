import os from "os";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "../../");

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
  serverExternalPackages: ["better-sqlite3", "tesseract.js"],
  turbopack: {
    root: workspaceRoot
  },
  allowedDevOrigins: ["localhost", "127.0.0.1", ...localIPs]
};

export default nextConfig;
