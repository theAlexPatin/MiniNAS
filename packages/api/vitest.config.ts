import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./test/setup.ts"],
    pool: "forks", // Required for native modules (better-sqlite3)
    testTimeout: 10_000,
  },
});
