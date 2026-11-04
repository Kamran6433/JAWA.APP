import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "test/e2e",
  timeout: 30_000,
  expect: { timeout: 7_500 },
  workers: 1,
  fullyParallel: false,
  reporter: [ [ "list" ] ],
  use: { trace: "retain-on-failure" },
});
