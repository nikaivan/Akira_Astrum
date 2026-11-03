import { defineConfig, devices } from "@playwright/test";
import { E2E_BASE_URL, E2E_PORT, loadTestEnvironment, serverEnvFor } from "./tests/e2e/support/environment";

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;

// Aborta antes de arrancar nada si el entorno no es el del proyecto de test (ver tests/integration/README.md).
const testEnvironment = loadTestEnvironment();

export default defineConfig({
  testDir: "tests/e2e",
  use: {
    baseURL: E2E_BASE_URL,
    launchOptions: { executablePath },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npm run dev -- --port ${E2E_PORT}`,
    // Una página que no lee datos: así el servidor arranca aunque Supabase no responda.
    url: `${E2E_BASE_URL}/login`,
    // Nunca se reutiliza un servidor ya levantado: podría estar conectado a producción.
    reuseExistingServer: false,
    env: serverEnvFor(testEnvironment),
  },
});
