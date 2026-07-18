import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    exclude: ["test/e2e/**", "node_modules/**", ".next/**"],
    coverage: { reporter: ["text", "json", "html"] },
  },
  resolve: { alias: { "@": path.resolve(__dirname, "./src"), "server-only": path.resolve(__dirname, "./test/server-only.ts") } },
});
