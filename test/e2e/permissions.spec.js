import { expect, test } from "@playwright/test";
import { startFakeSite } from "../support/fake-site.js";
import { launchApp } from "../support/launch.js";

let site;
test.beforeEach(async () => { site = await startFakeSite(); });
test.afterEach(async () => { await site.stop(); });

for (const kind of [ "pos", "food" ]) {
  test(`${kind}: notifications, location and camera are refused without asking`, async () => {
    const { app, window } = await launchApp({ kind, origins: { [kind]: site.origin } });
    await window.goto(`${site.origin}/permissions`);
    const results = await window.evaluate(() => window.results);
    const { camera, ...rest } = results;
    expect(rest).toEqual({
      notifications: "denied", geolocation: "denied", node: "undefined/undefined/undefined",
      states: { camera: "denied", microphone: "denied", geolocation: "denied", notifications: "denied" },
    });
    // Refused where a camera exists; machines without one (such as CI) report none found. Never granted.
    expect([ "NotAllowedError", "NotFoundError" ]).toContain(camera);
    await app.close();
  });
}
