import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    passWithNoTests: true,
    environment: "node",
    include: ["**/*.test.ts", "**/*.spec.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**", ".personabench/**"],
  },
});
