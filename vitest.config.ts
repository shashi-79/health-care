import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const workspacePackagesDir = path.resolve(rootDir, "packages").replace(/\\/g, "/");

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@rhc\/([^/]+)\/(.*)$/,
        replacement: `${workspacePackagesDir}/$1/src/$2`
      },
      {
        find: /^@rhc\/([^/]+)$/,
        replacement: `${workspacePackagesDir}/$1/src/index.ts`
      }
    ]
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node"
  }
});
