import { defineConfig } from "@playwright/test";

// Live checks against locally running JAWA servers with fictional accounts.
// See docs/verification.md for the setup; they skip themselves otherwise.
export default defineConfig({
  testDir: "test/live",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [ [ "list" ] ],
});
