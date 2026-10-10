import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { environment: "node", include: ["tests/**/*.test.ts"], fileParallelism: false, env: { DEMO_MODE: "true", OTP_DEV_MODE: "true", NODE_ENV: "test" } },
});
