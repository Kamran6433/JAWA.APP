import { expect, test } from "@playwright/test";
import { startFakeSite } from "../support/fake-site.js";
import { launchApp } from "../support/launch.js";

test("with the site unreachable the app explains and recovers when it's back", async () => {
  const site = await startFakeSite({ title: "Fake POS" });
  await site.stop();
  const { app, window } = await launchApp({ kind: "pos", origins: { pos: site.origin } });

  await expect(window.locator("h1")).toHaveText("JAWA POS can’t connect");
  await expect(window).toHaveTitle("JAWA POS");
  expect(window.url()).toMatch(/^data:text\/html/);
  await expect(window.locator("a.retry")).toHaveAttribute("href", `${site.origin}/`);

  await site.restart();
  await window.click("a.retry");
  await expect(window.locator("#where")).toHaveText("Fake POS");
  await app.close();
  await site.stop();
});

test("a page that fails later is the one retried", async () => {
  const site = await startFakeSite({ title: "Fake POS" });
  const { app, window } = await launchApp({ kind: "pos", origins: { pos: site.origin } });
  await expect(window.locator("#where")).toHaveText("Fake POS");
  await site.stop();
  await window.evaluate(() => { location.href = "/second"; });
  await expect(window.locator("h1")).toHaveText("JAWA POS can’t connect");
  await expect(window.locator("a.retry")).toHaveAttribute("href", `${site.origin}/second`);
  await app.close();
});
