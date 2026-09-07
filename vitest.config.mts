import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const srcDir = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": srcDir,
    },
  },
  test: {
    projects: [
      {
        test: {
          name: "node",
          include: [
            "src/domain/**/*.test.ts",
            "src/application/**/*.test.ts",
            "src/infrastructure/db/**/*.test.ts",
            "src/infrastructure/primary/actions/**/*.test.ts",
          ],
          environment: "node",
        },
      },
      {
        test: {
          name: "ui",
          include: ["src/infrastructure/primary/ui/**/*.test.tsx"],
          environment: "jsdom",
          setupFiles: ["./vitest.setup.ts"],
        },
        plugins: [react()],
      },
    ],
  },
});
