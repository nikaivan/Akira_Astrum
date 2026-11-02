import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Solo se carga .env.test.local (claves del proyecto de test). Vite no carga ningún otro .env*.
try {
  process.loadEnvFile(".env.test.local");
} catch {
  throw new Error("Falta el archivo .env.test.local: ver tests/integration/README.md.");
}

export default defineConfig({
  envDir: false,
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["tests/integration/support/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
