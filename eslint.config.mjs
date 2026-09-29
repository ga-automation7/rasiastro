import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": "error",
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  {
    // Client components are named *.client.tsx. They run in the browser, so they
    // must never import server modules (secrets, database, providers).
    files: ["src/**/*.client.tsx", "src/**/*.client.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/server/*", "@/server"],
              message:
                "Client components must not import server-only modules. Call an API route instead.",
            },
          ],
        },
      ],
    },
  },
  {
    // CLI scripts print to the terminal on purpose.
    files: ["scripts/**/*.ts"],
    rules: { "no-console": "off" },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", ".data/**", "exports/**", "coverage/**"]),
]);

export default eslintConfig;
