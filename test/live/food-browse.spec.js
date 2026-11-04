import { expect, test } from "@playwright/test";
import { launchApp } from "../support/launch.js";

// The real JAWA.FOOD desktop app against a real local FOOD. Customer sign-in
// waits for FOOD-8; this checks browsing, the window and outbound links.
const foodOrigin = process.env.JAWA_LIVE_FOOD_ORIGIN;
const posOrigin = process.env.JAWA_LIVE_POS_ORIGIN ?? "http://localhost:3000";

test.skip(!foodOrigin, "Set JAWA_LIVE_FOOD_ORIGIN to a local FOOD server");

test("FOOD opens its live home page in its own window and keeps other sites out", async () => {
  const { app, window, openedInBrowser } = await launchApp({ kind: "food", origins: { food: foodOrigin, pos: posOrigin } });
  await expect(window).toHaveURL(`${foodOrigin}/`);
  await expect(window).toHaveTitle(/JAWA/);
  expect(await window.evaluate(() => navigator.userAgent)).toMatch(/ JAWADesktop\/0\.1\.0 \(food\)$/);

  await window.evaluate(() => { location.href = "https://site.jawa.example/"; }).catch(() => {});
  await expect.poll(openedInBrowser).toEqual([ "https://site.jawa.example/" ]);
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getURL())).toBe(`${foodOrigin}/`);
  await app.close();
});
