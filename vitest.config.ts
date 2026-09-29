import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // PGlite (in-process Postgres) and the PDF test start real engines; allow time.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // Tests must never pick up a developer's real credentials.
    env: {
      APP_MODE: "demo",
      NODE_ENV: "test",
    },
    pool: "forks",
  },
});
