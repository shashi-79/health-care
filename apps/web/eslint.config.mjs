import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@rhc/tools/*"],
              message: "Only BG agent modules may import tools directly."
            },
            {
              group: ["@rhc/db/ui-messages"],
              message: "UI transcript store is isolated from agent logic."
            }
          ]
        }
      ]
    }
  },
  globalIgnores([".next/**", "out/**", "build/**", "dist/**", "next-env.d.ts"])
]);
