import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    coverage: {
      include: ["src/features/**/*.{ts,tsx}", "src/lib/**/*.{ts,tsx}"],
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      thresholds: {
        branches: 80,
        functions: 90,
        lines: 90,
        statements: 90,
      },
    },
    environment: "jsdom",
    server: {
      // next-intl's navigation helpers import extensionless "next/..."
      // subpaths that only resolve when bundled (as Next.js itself does);
      // left external, Vitest hands them to Node's stricter ESM resolver.
      deps: {
        inline: [/next-intl/, /^next$/],
      },
    },
    setupFiles: ["./vitest-setup.ts"],
  },
});
